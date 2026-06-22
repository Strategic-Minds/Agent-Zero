import { NextRequest, NextResponse } from "next/server"
import { runEvolutionCycle, formatEvolutionReport } from "@/agents/evolution"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const result = await runEvolutionCycle({
    current_score: Number(body.current_score) || 70,
    target_score: Number(body.target_score) || 95,
  })
  return NextResponse.json({ ok: true, result, formatted: formatEvolutionReport(result) })
}

export async function GET() {
  return NextResponse.json({ agent: "Evolution Engine", description: "POST with {current_score, target_score} to run evolution cycle" })
}
