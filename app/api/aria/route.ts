/**
 * ARIA API v5 — /api/aria
 * DIRECT call to lib/ai.ts (no dynamic import, no agents/aria.ts wrapper)
 * Same pattern as /api/ai-test which proves 27ms Groq response
 */
import { NextRequest, NextResponse } from "next/server";
import { aiChat, aiProviderStatus } from "@/lib/ai";

export const dynamic  = "force-dynamic";
export const runtime  = "nodejs";
export const maxDuration = 45;

const ARIA_SYSTEM = `You are ARIA, the AI assistant for Xtreme Polishing Systems (XPS).
XPS does commercial epoxy flooring and concrete polishing in Arizona.
Be professional, concise, and action-oriented. Help book free site assessments.`;

export async function GET() {
  const status = aiProviderStatus();
  return NextResponse.json({
    agent: "ARIA v5", status: "active",
    active_provider: status.active_provider,
    groq_model: status.groq_model,
    capabilities: ["chat","reason","analyze","lead_query","score","stream"],
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    message?: string; conversation_id?: string;
    history?: unknown[]; stream?: boolean; channel?: string;
  };
  const message = (body.message || "Hello").slice(0, 2000);
  const convId  = body.conversation_id || "aria_" + Date.now();
  const start   = Date.now();

  const res = await aiChat(ARIA_SYSTEM, message, { maxTokens: 600 });

  // Fire-and-forget Supabase log (non-blocking)
  if (res.provider !== "static") {
    setImmediate(async () => {
      try {
        const { getSupabaseAdmin } = await import("@/lib/supabase");
        const db = getSupabaseAdmin();
        await db.from("call_logs" as any).insert({
          company_name: "ARIA Session",
          call_date: new Date().toISOString(),
          call_outcome: "aria_chat",
          call_notes: `Q: ${message.slice(0,120)} | A: ${res.content.slice(0,120)}`,
          ai_call_summary: `Provider: ${res.provider}`,
        });
      } catch { /* non-fatal */ }
    });
  }

  return NextResponse.json({
    ok: true,
    response:        res.content,
    reply:           res.content,
    content:         res.content,
    conversation_id: convId,
    provider:        res.provider,
    model:           res.model,
    toolsUsed:       ["lib_ai"],
    latency_ms:      Date.now() - start,
    latencyMs:       Date.now() - start,
  });
}
