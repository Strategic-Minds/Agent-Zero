import { NextRequest, NextResponse } from "next/server"
import { generateSOPSummary } from "@/lib/sop-tracker"
import { runSelfReflection } from "@/agents/reflection-agent"
import { buildSOPEmailHTML, sendEmail } from "@/lib/email-reporter"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || req.headers.get("x-cron-secret") || ""
  const secret = process.env.CRON_SECRET || ""
  if (auth !== "Bearer " + secret && auth !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results: Record<string, unknown> = {}

  // 1. Generate SOP summary
  const sopSummary = await generateSOPSummary(4).catch(e => ({ error: String(e) }))
  results.sop = sopSummary

  // 2. Run self-reflection
  const reflection = await runSelfReflection(4).catch(e => ({ error: String(e) }))
  results.reflection = reflection

  // 3. Get latest audit score
  let auditScore: number | undefined
  try {
    const base = process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000"
    const auditRes = await fetch(base + "/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject_url: base, subject_name: "Agent Zero Auto-Reflect" }),
      signal: AbortSignal.timeout(60000),
    })
    const auditData = await auditRes.json() as Record<string, unknown>
    auditScore = auditData.overall_score as number
    results.audit_score = auditScore
  } catch { results.audit_note = "Audit skipped in this cycle" }

  // 4. Build + send email
  const isSOP = (sopSummary as Record<string,unknown>).narrative !== undefined
  if (isSOP) {
    const htmlReport = buildSOPEmailHTML(sopSummary as Parameters<typeof buildSOPEmailHTML>[0], auditScore)
    const emailResult = await sendEmail({
      subject: `Agent Zero Report — ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}`,
      to: process.env.REPORT_EMAIL || "strategicmindsadvisory@gmail.com",
      body_html: htmlReport,
      body_text: (sopSummary as { narrative?: string }).narrative || "Agent Zero 4-hour report",
    })
    results.email = emailResult
  }

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), ...results })
}
