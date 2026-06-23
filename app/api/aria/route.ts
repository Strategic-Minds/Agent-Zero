/**
 * ARIA v7.4 — /api/aria
 * Inline system prompt, no module-level const, explicit error logging
 */
import { NextRequest, NextResponse } from "next/server";
import { ai, aiProviderStatus } from "@/lib/ai";

export const dynamic    = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const s = aiProviderStatus();
  return NextResponse.json({
    agent: "ARIA v7.4", status: "active",
    active_provider: s.active_provider,
    groq_model: s.groq_model,
    groq_key_present: s.groq,
  });
}

export async function POST(req: NextRequest) {
  const start = Date.now();

  let message = "Hello";
  try {
    const body = await req.json() as { message?: string; conversation_id?: string };
    message = (body.message || "Hello").slice(0, 2000);
  } catch { /* use default */ }

  const convId = `aria_${start}`;

  // Call AI with inline messages array — no module-level const
  const result = await ai([
    {
      role: "system" as const,
      content: "You are ARIA, the AI sales assistant for Xtreme Polishing Systems (XPS). XPS specializes in commercial epoxy flooring and concrete polishing in Arizona. Be professional, concise, and focused on booking site assessments.",
    },
    {
      role: "user" as const,
      content: message,
    },
  ], { maxTokens: 500 });

  const latency = Date.now() - start;

  if (result.provider === "static") {
    console.error(`[ARIA] static response at ${latency}ms — groq_key=${(process.env.GROQ_API_KEY||"").length > 0}`);
  }

  return NextResponse.json({
    ok:              result.provider !== "static",
    response:        result.content,
    reply:           result.content,
    content:         result.content,
    conversation_id: convId,
    provider:        result.provider,
    model:           result.model,
    latency_ms:      latency,
    latencyMs:       latency,
  });
}
