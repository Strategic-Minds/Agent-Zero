/**
 * ARIA v7 — /api/aria
 * Uses lib/ai.ts raw fetch (no SDK adapter). Clean. Simple. Works.
 */
import { NextRequest, NextResponse } from "next/server";
import { aiChat, aiProviderStatus } from "@/lib/ai";

export const dynamic    = "force-dynamic";
export const maxDuration = 30;

const SYSTEM = `You are ARIA, the AI sales assistant for Xtreme Polishing Systems (XPS).
XPS specializes in commercial epoxy flooring and concrete polishing in Arizona.
Be professional, concise, and focused on booking site assessments.`;

export async function GET() {
  const s = aiProviderStatus();
  return NextResponse.json({
    agent: "ARIA v7", status: "active",
    active_provider: s.active_provider,
    groq_model: s.groq_model,
  });
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  const body  = await req.json().catch(() => ({})) as {
    message?: string; conversation_id?: string; stream?: boolean;
  };
  const message = (body.message || "Hello").slice(0, 2000);

  const result = await aiChat(SYSTEM, message, { maxTokens: 500 });

  return NextResponse.json({
    ok:              result.provider !== "static",
    response:        result.content,
    reply:           result.content,
    content:         result.content,
    conversation_id: body.conversation_id || `aria_${start}`,
    provider:        result.provider,
    model:           result.model,
    latency_ms:      Date.now() - start,
    latencyMs:       Date.now() - start,
  });
}
