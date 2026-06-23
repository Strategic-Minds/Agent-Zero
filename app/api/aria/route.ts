/**
 * ARIA API v3 — /api/aria
 * Fix 7: LLM response streaming (SSE) — no more full-wait latency
 * Supports both streaming (stream:true) and standard JSON response
 */
import { NextRequest, NextResponse } from "next/server"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

export async function GET() {
  return NextResponse.json({
    agent: "ARIA — Autonomous Reasoning and Intelligence Agent",
    version: "3.0",
    capabilities: ["chat","reason","analyze","lead_query","scrape","score","outreach","stream"],
    streaming: "Set stream:true in POST body for SSE streaming",
    endpoint: "POST /api/aria",
    body: { message: "string", conversation_id: "string?", stream: "boolean?" },
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    message?: string; conversation_id?: string; history?: unknown[]; stream?: boolean
  }
  const message = body.message || body.conversation_id || "Hello"
  const wantStream = body.stream === true

  try {
    if (wantStream) {
      // ── STREAMING RESPONSE ─────────────────────────────────────────
      const groqKey = process.env.GROQ_API_KEY
      const openaiKey = process.env.OPENAI_API_KEY
      if (!groqKey && !openaiKey) {
        return NextResponse.json({ error: "No LLM key configured" }, { status: 500 })
      }

      const isGroq = !!groqKey
      const endpoint = isGroq
        ? "https://api.groq.com/openai/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions"
      const model = isGroq ? "llama-3.3-70b-versatile" : "gpt-4o-mini"

      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${isGroq ? groqKey : openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You are ARIA, the AI agent for Xtreme Polishing Systems (XPS). You help with lead discovery, scoring, outreach, and business intelligence for epoxy and concrete coating contractors in Arizona. Be concise, professional, and action-oriented." },
            { role: "user", content: message },
          ],
          stream: true,
          max_tokens: 1000,
          temperature: 0.4,
        }),
      })

      if (!upstream.ok || !upstream.body) {
        return NextResponse.json({ error: "LLM stream failed" }, { status: 500 })
      }

      // Pipe the SSE stream directly to client
      return new Response(upstream.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Transfer-Encoding": "chunked",
        },
      })
    }

    // ── STANDARD JSON RESPONSE ──────────────────────────────────────
    const { chat } = await import("@/agents/aria")
    const result = await chat(message, (body.history || []) as import('@/agents/aria').ARIAMessage[], body.conversation_id || 'default')
    return NextResponse.json({ ok: true, ...result })

  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
