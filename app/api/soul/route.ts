import { NextResponse } from "next/server"
import { AGENT_ZERO_SOUL, BASE44_CAPABILITIES, AGENT_ZERO_CAPABILITIES, SYSTEM_IDENTITY } from "@/lib/soul"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({
    ok: true,
    identity: SYSTEM_IDENTITY,
    base44_capabilities: BASE44_CAPABILITIES,
    agent_zero_capabilities: AGENT_ZERO_CAPABILITIES,
    soul_preview: AGENT_ZERO_SOUL.slice(0, 300) + "...",
  })
}
