import { NextResponse } from "next/server"
import { AGENT_ZERO_SOPS, saveSOPs } from "@/agents/sop"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({ ok: true, count: AGENT_ZERO_SOPS.length, sops: AGENT_ZERO_SOPS })
}

export async function POST() {
  await saveSOPs()
  return NextResponse.json({ ok: true, message: `${AGENT_ZERO_SOPS.length} SOPs saved to Supabase` })
}
