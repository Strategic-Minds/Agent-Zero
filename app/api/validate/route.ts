import { NextResponse } from "next/server"
import { runValidation } from "@/agents/validator"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get("url") || `https://${process.env.VERCEL_URL || "agent-zero-beta.vercel.app"}`
  const secret = searchParams.get("secret")

  if (secret !== process.env.CRON_SECRET && !req.headers.get("x-internal")) {
    // Allow public GET for status page — run only quick tests
    return NextResponse.json({
      message: "Validator ready. POST with secret to run full validation.",
      endpoint: "/api/validate",
      tests_available: 30,
      rule: "NO URL IS SHARED UNTIL ALL CRITICAL TESTS PASS + TRIPLE CHECK",
    })
  }

  const report = await runValidation(url)
  return NextResponse.json(report)
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret")
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { url?: string }
  const deploymentUrl = body.url || `https://${process.env.VERCEL_URL || "agent-zero-beta.vercel.app"}`

  const report = await runValidation(deploymentUrl)

  return NextResponse.json({
    run_id: report.run_id,
    url_cleared: report.url_cleared,
    faang_grade: report.faang_grade,
    overall_score: report.overall_score,
    triple_check_passed: report.triple_check_passed,
    passed: report.passed,
    failed: report.failed,
    critical_failures: report.critical_failures,
    recommendation: report.recommendation,
    blocking_issues: report.blocking_issues,
    results_summary: report.results.map(r => ({
      name: r.test_name,
      passed: r.passed,
      score: r.score,
      severity: r.severity,
    })),
  })
}
