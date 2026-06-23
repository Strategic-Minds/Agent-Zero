import { NextRequest, NextResponse } from "next/server"
import { runHumanValidation } from "@/lib/headless-validator"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || req.headers.get("x-cron-secret") || ""
  const secret = process.env.CRON_SECRET || ""
  if (auth !== "Bearer " + secret && auth !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const base = process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000"

  // P0-only fast triple-check (3 runs of critical tests only)
  const runs = []
  for (let i = 0; i < 3; i++) {
    const report = await runHumanValidation(base, { priorities: ["P0"], maxTests: 20 })
    runs.push({
      run: i + 1,
      score: report.score,
      grade: report.grade,
      passed: report.passed,
      failed: report.failed,
      p0_failures: report.p0_failures,
      cleared: report.deployment_approved,
    })
    if (i < 2) await new Promise(r => setTimeout(r, 2000))
  }

  const avgScore = Math.round(runs.reduce((s, r) => s + r.score, 0) / 3)
  const allCleared = runs.every(r => r.cleared)
  const anyP0Failure = runs.some(r => r.p0_failures > 0)

  return NextResponse.json({
    triple_check: true,
    runs,
    avg_score: avgScore,
    all_cleared: allCleared,
    any_p0_failure: anyP0Failure,
    recommendation: allCleared ? "CLEARED — all 3 runs passed P0 tests" : "BLOCKED — " + runs.filter(r => !r.cleared).length + " runs failed",
    timestamp: new Date().toISOString(),
  })
}
