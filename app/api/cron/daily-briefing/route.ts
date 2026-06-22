import { NextResponse } from "next/server"
import { sendDailyBriefing } from "@/agents/reporter"
import { runEvolutionCycle } from "@/agents/evolution"
import { reflect } from "@/agents/reflection"
import { saveSOPs } from "@/agents/sop"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret") || req.headers.get("x-cron-secret")
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Run all daily tasks in parallel
  const [briefingResult, evolutionResult] = await Promise.all([
    sendDailyBriefing(),
    runEvolutionCycle({ current_score: 75, target_score: 95 }),
    saveSOPs(),
  ])

  // Reflect on the daily run
  const reflectionResult = await reflect({
    run_id: "daily_" + Date.now(),
    run_type: "daily_briefing",
  })

  return NextResponse.json({
    ok: true,
    briefing: briefingResult,
    evolution: evolutionResult,
    reflection: { health_score: reflectionResult.overall_health_score },
    timestamp: new Date().toISOString(),
  })
}
