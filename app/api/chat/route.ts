/**
 * /api/chat — JSON chat endpoint (ai@3.x — no streaming dependency issues)
 * Returns full response synchronously — frontend polls
 */
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json() as { messages: Array<{ role: string; content: string }> }
    const last = messages[messages.length - 1]?.content || ""
    const history = messages.slice(0, -1).map(m => ({ role: m.role as "user" | "assistant", content: m.content }))

    const { chat } = await import("../../../agents/aria")
    const result = await chat(last, history, "web_chat", "web")

    return NextResponse.json({ role: "assistant", content: result.response, tools_used: result.toolsUsed, model: result.model, latency_ms: result.latencyMs })
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 500 })
  }
}
