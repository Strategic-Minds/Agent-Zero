/**
 * ARIA v2 Route — /api/aria
 * Non-streaming: WhatsApp bridge, direct API, command interface
 */
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, history = [], channel = "web", session_id } = body
    if (!message) return NextResponse.json({ error: "message required" }, { status: 400 })
    const { chat } = await import("../../../agents/aria")
    const result = await chat(message, history, session_id || "default", channel)
    return NextResponse.json({ response: result.response, tools_used: result.toolsUsed, memory_updated: result.memoryUpdated, actions_taken: result.actionsTaken, suggested_next: result.suggestedNextAction, model: result.model, latency_ms: result.latencyMs })
  } catch (e) {
    return NextResponse.json({ error: "ARIA error", details: String(e).slice(0, 300) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ agent: "ARIA", version: "2.0.0", status: "operational", capabilities: ["full_tool_use_20_tools", "persistent_memory", "multi_turn", "streaming_via_api_chat", "whatsapp_bidirectional", "hubspot_crm", "github_integration", "web_research", "multi_model_fallback", "governance_enforcement"] })
}
