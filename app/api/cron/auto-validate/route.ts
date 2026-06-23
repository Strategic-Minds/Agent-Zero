import { NextRequest, NextResponse } from "next/server"
import { runValidation } from "@/agents/validator"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || ""
  const secret = process.env.CRON_SECRET || ""
  if (auth !== "Bearer " + secret && req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const base = process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000"
  // Triple validation: run 3 times
  const results = []
  for (let i = 0; i < 3; i++) {
    try {
      const r = await runValidation(base)
      results.push({ run: i + 1, score: r.score, grade: r.grade, cleared: r.deployment_approved, critical_failures: r.critical_failures })
    } catch (e) {
      results.push({ run: i + 1, score: 0, grade: "F", cleared: false, error: String(e).slice(0, 100) })
    }
    if (i < 2) await new Promise(r => setTimeout(r, 5000))
  }
  const avgScore = Math.round(results.reduce((s, r) => s + (r.score || 0), 0) / 3)
  const allCleared = results.every(r => r.cleared)
  return NextResponse.json({ triple_check: true, runs: results, avg_score: avgScore, all_cleared: allCleared, timestamp: new Date().toISOString() })
}
