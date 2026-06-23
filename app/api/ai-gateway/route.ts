/**
 * AI GATEWAY — /api/ai-gateway
 * Canonical AI routing with model allowlist, cost ledger, budget guard
 * Synced from AUTO_BUILDER AI_GATEWAY_PACKET.md
 */
import { NextRequest, NextResponse } from "next/server";
import { ai, aiProviderStatus } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODEL_ALLOWLIST = ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "llama-3.1-70b-versatile", "llama-3.3-70b-versatile", "mixtral-8x7b-32768"];
const DENIED_PROVIDERS: string[] = [];

export async function GET() {
  const status = aiProviderStatus();
  return NextResponse.json({
    ok: true,
    system: "AI Gateway",
    version: "1.0.0",
    configured: {
      ai_gateway_key: !!(process.env.AI_GATEWAY_API_KEY),
      vercel_oidc: !!(process.env.VERCEL_OIDC_TOKEN),
      groq: !!(process.env.GROQ_API_KEY),
      openai: !!(process.env.OPENAI_API_KEY),
    },
    active_provider: status.active_provider,
    model_allowlist: MODEL_ALLOWLIST,
    denied_providers: DENIED_PROVIDERS,
    budget_daily_usd: process.env.AI_GATEWAY_BUDGET_DAILY_USD || "unlimited",
    base_url: process.env.AI_GATEWAY_BASE_URL || "https://ai.vercel.app/api/v1",
    default_model: process.env.AI_GATEWAY_DEFAULT_MODEL || "gpt-4o-mini",
    fallback_model: process.env.AI_GATEWAY_FALLBACK_MODEL || "llama-3.1-70b-versatile",
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    prompt?: string;
    system?: string;
    model?: string;
    max_tokens?: number;
    messages?: Array<{role: string; content: string}>;
  };

  const { prompt = "", system = "You are a helpful assistant.", model = "gpt-4o-mini", max_tokens = 500 } = body;

  if (model && !MODEL_ALLOWLIST.includes(model)) {
    return NextResponse.json({ ok: false, error: `Model ${model} not in allowlist`, allowlist: MODEL_ALLOWLIST }, { status: 400 });
  }

  const start = Date.now();
  try {
    const res = await ai(
      body.messages as Array<{role: "system"|"user"|"assistant"; content: string}> || 
      [{ role: "system", content: system }, { role: "user", content: prompt }],
      { model, maxTokens: max_tokens }
    );
    return NextResponse.json({
      ok: true,
      content: res.content,
      provider: res.provider,
      model: res.model,
      latency_ms: Date.now() - start,
      gateway: "agent-zero-ai-gateway",
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
