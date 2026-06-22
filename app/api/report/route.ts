import { NextResponse } from "next/server"
import { sendDailyBriefing, compileReport, buildEmailHTML } from "@/agents/reporter"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  // Preview the report without sending
  const report = await compileReport()
  const html = buildEmailHTML(report)
  return new NextResponse(html, { headers: { "Content-Type": "text/html" } })
}

export async function POST() {
  const result = await sendDailyBriefing()
  return NextResponse.json({ ok: result.success, ...result })
}
