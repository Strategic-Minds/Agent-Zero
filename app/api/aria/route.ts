import { NextResponse } from "next/server"
import { chat } from "@/agents/aria"
import type { ARIAMessage } from "@/agents/aria"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function GET() {
  return NextResponse.json({ status: "ARIA v3.0 online", channels: ["web", "studio", "whatsapp", "slack"] })
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      message?: string
      history?: ARIAMessage[]
      channel?: string
      session_id?: string
      system_override?: string
    }

    const { message, history = [], channel = "web", session_id, system_override } = body

    if (!message?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 })

    const result = await chat(message, history, session_id || "default", channel, system_override)

    return NextResponse.json({
      response: result.response,
      tools_used: result.toolsUsed,
      memory_updated: result.memoryUpdated,
      actions_taken: result.actionsTaken,
      model: result.model,
      latency_ms: result.latencyMs,
    })
  } catch (e) {
    const msg = String(e)
    return NextResponse.json({ error: "ARIA error", details: msg.slice(0, 200) }, { status: 500 })
  }
}
