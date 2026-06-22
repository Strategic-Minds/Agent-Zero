/**
 * /api/chat — JSON chat endpoint (synchronous, ai@3.x)
 */
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"  
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { messages?: Array<{ role: string; content: string }> }
    const messages = body?.messages || []
    if (!messages.length) return NextResponse.json({ role: "assistant", content: "No message provided." })
    
    const last = messages[messages.length - 1]?.content || ""
    const history = messages.slice(0, -1).filter(m => m.role === "user" || m.role === "assistant").map(m => ({ role: m.role as "user" | "assistant", content: m.content }))

    const { chat } = await import("../../../agents/aria")
    const result = await chat(last, history, "web_chat", "web")

    return NextResponse.json({
      id: `msg_${Date.now()}`,
      role: "assistant",
      content: result.response,
      tools_used: result.toolsUsed,
      model: result.model,
      latency_ms: result.latencyMs
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ role: "assistant", content: `I'm having trouble right now: ${msg.slice(0, 150)}. Please try again in a moment.` }, { status: 200 })
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "/api/chat", method: "POST", body: { messages: [{ role: "user", content: "..." }] } })
}
