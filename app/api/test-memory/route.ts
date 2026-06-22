import { NextResponse } from "next/server"
import {
  getAllTestMemory, getRunHistory, getRegressions,
  getFlakyTests, getTestHealthReport, markRegressionResolved
} from "@/lib/test-memory"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const view = searchParams.get("view") || "health"

  switch (view) {
    case "health": {
      const report = await getTestHealthReport()
      return NextResponse.json(report)
    }
    case "all": {
      const all = await getAllTestMemory()
      return NextResponse.json({ total: all.length, tests: all })
    }
    case "history": {
      const limit = parseInt(searchParams.get("limit") || "20")
      const runs = await getRunHistory(limit)
      return NextResponse.json({ total: runs.length, runs })
    }
    case "regressions": {
      const regressions = await getRegressions(false)
      return NextResponse.json({ total: regressions.length, regressions })
    }
    case "flaky": {
      const flaky = await getFlakyTests()
      return NextResponse.json({ total: flaky.length, tests: flaky })
    }
    default:
      return NextResponse.json({ error: "Unknown view. Use: health | all | history | regressions | flaky" }, { status: 400 })
  }
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret")
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { action?: string; test_id?: string }

  if (body.action === "resolve_regression" && body.test_id) {
    await markRegressionResolved(body.test_id)
    return NextResponse.json({ ok: true, resolved: body.test_id })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
