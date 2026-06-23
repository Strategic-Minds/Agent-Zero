import { NextResponse } from "next/server"
import { runCapabilityBenchmark, getLatestBenchmarkRun } from "@/lib/benchmark-engine"
import { TOP_30_CAPABILITIES, getCapabilityStats } from "@/lib/capabilities"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET() {
  const latest = await getLatestBenchmarkRun()
  const stats = getCapabilityStats()
  return NextResponse.json({ score: stats.avgCurrent, overall_score: stats.avgCurrent, stats, latest, capabilities: TOP_30_CAPABILITIES })
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret")
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { capability_id?: number }
  const results = await runCapabilityBenchmark(body.capability_id)
  const stats = getCapabilityStats()

  return NextResponse.json({
    run_id: results[0]?.run_id,
    capabilities_tested: results.length,
    avg_score: Math.round(results.reduce((a, r) => a + r.score, 0) / results.length),
    stats,
    results: results.slice(0, 10),
  })
}
