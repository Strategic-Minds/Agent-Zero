import { NextRequest, NextResponse } from "next/server"
import { runEvolutionCycle } from "@/agents/evolution-agent"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || req.headers.get("x-cron-secret") || ""
  const secret = process.env.CRON_SECRET || ""
  if (auth !== "Bearer " + secret && auth !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const plan = await runEvolutionCycle()
    return NextResponse.json({ ok: true, plan })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
