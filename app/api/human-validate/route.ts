import { NextRequest, NextResponse } from "next/server"
import { runHumanValidation, buildTestSuite } from "@/lib/headless-validator"
import type { TestCategory, TestPriority } from "@/lib/headless-validator"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("suite") === "list") {
    const baseUrl = process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000"
    const suite = buildTestSuite(baseUrl)
    return NextResponse.json({
      total: suite.length,
      categories: [...new Set(suite.map(t => t.category))],
      by_priority: { P0: suite.filter(t => t.priority==="P0").length, P1: suite.filter(t => t.priority==="P1").length, P2: suite.filter(t => t.priority==="P2").length, P3: suite.filter(t => t.priority==="P3").length },
      tests: suite.map(t => ({ id: t.id, name: t.name, category: t.category, priority: t.priority, severity: t.severity, benchmark_target: t.benchmark_target }))
    })
  }
  return NextResponse.json({ status: "Human Validation Agent — ready", endpoints: { "POST /api/human-validate": "Run validation", "GET ?suite=list": "List all tests" } })
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("x-cron-secret") || req.headers.get("authorization") || ""
  const secret = process.env.CRON_SECRET || ""
  const isPublic = req.headers.get("x-human-validate") === "true"
  if (!isPublic && auth !== secret && auth !== "Bearer " + secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const baseUrl = (body.base_url as string) || (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000")
  const categories = body.categories as TestCategory[] | undefined
  const priorities = body.priorities as TestPriority[] | undefined
  const maxTests = body.max_tests as number | undefined

  try {
    const report = await runHumanValidation(baseUrl, { categories, priorities, maxTests })
    return NextResponse.json(report)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
