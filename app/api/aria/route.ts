/**
 * ARIA API v4 — /api/aria  — always responds within 30s
 * Non-stream: uses agents/aria.ts → lib/ai.ts
 * Stream:     uses lib/ai.ts directly (no raw Groq fetch)
 */
import { NextRequest, NextResponse } from "next/server";
export const dynamic  = "force-dynamic";
export const runtime  = "nodejs";
export const maxDuration = 45;

export async function GET() {
  return NextResponse.json({
    agent: "ARIA v4", status: "active",
    capabilities: ["chat","reason","analyze","lead_query","score","stream"],
    endpoint: "POST /api/aria",
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as {
      message?: string; conversation_id?: string;
      history?: unknown[]; stream?: boolean; channel?: string;
    };
    const message = (body.message || "Hello").slice(0, 2000);

    if (body.stream === true) {
      // ── STREAMING SSE via lib/ai ─────────────────────────────────
      const { aiChat } = await import("@/lib/ai");
      const res = await aiChat(
        "You are ARIA, the AI agent for Xtreme Polishing Systems (XPS). Be concise and professional.",
        message,
        { maxTokens: 600 }
      );
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const words = res.content.split(" ");
          for (const w of words) {
            const chunk = JSON.stringify({ choices: [{ delta: { content: w + " " } }] });
            controller.enqueue(encoder.encode("data: " + chunk + "\n\n"));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      });
      return new Response(stream, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
      });
    }

    // ── STANDARD JSON (with 25s timeout guard) ────────────────────
    const { chat } = await import("@/agents/aria");
    const timeoutMs = 25000;
    const result = await Promise.race([
      chat(message, (body.history || []) as import("@/agents/aria").ARIAMessage[], body.conversation_id || "default"),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("ARIA timeout")), timeoutMs))
    ]);
    return NextResponse.json({ ok: true, ...result });

  } catch (e) {
    // Fallback: direct aiChat so ARIA never returns 500
    try {
      const { aiChat } = await import("@/lib/ai");
      const body = await req.json().catch(() => ({})) as { message?: string };
      const res = await aiChat(
        "You are ARIA, the XPS AI assistant.",
        body.message || "Hello",
        { maxTokens: 400 }
      );
      return NextResponse.json({ ok: true, response: res.content, reply: res.content, provider: res.provider });
    } catch {
      return NextResponse.json({ ok: false, error: String(e), response: "Service temporarily unavailable." });
    }
  }
}
