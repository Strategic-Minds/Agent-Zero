import { NextRequest, NextResponse } from "next/server"
import { shadowScrapeURL, shadowScrapeParallel, shadowCloneSite, runCompetitorIntel } from "@/agents/shadow"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

export async function GET() {
  return NextResponse.json({
    agent: "GHOST Shadow Technology",
    version: "2.0",
    capabilities: ["scrape_url", "scrape_parallel", "clone_site", "competitor_intel"],
    endpoints: { POST: "/api/ghost", body: { action: "scrape_url|scrape_parallel|clone_site|competitor_intel", url: "string", urls: "string[]" } }
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    action?: string; url?: string; urls?: string[]
    max_pages?: number; query?: string
  }
  const action = body.action || "scrape_url"

  try {
    if (action === "scrape_url" && body.url) {
      const result = await shadowScrapeURL(body.url)
      return NextResponse.json({ ok: true, action, result })
    }
    if (action === "scrape_parallel" && body.urls?.length) {
      const results = await shadowScrapeParallel(body.urls)
      return NextResponse.json({ ok: true, action, count: results.length, results })
    }
    if (action === "clone_site" && body.url) {
      const result = await shadowCloneSite(body.url, { maxPages: body.max_pages || 10 })
      return NextResponse.json({ ok: true, action, result })
    }
    if (action === "competitor_intel") {
      const result = await runCompetitorIntel(body.query || "Phoenix Arizona")
      return NextResponse.json({ ok: true, action, result })
    }
    return NextResponse.json({ error: "action required: scrape_url | scrape_parallel | clone_site | competitor_intel" }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
