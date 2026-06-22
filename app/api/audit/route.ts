import { NextRequest, NextResponse } from "next/server"
import { runIndependentAudit } from "@/lib/audit-engine"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

export async function GET() {
  return NextResponse.json({
    status: "Independent Enterprise Audit System v1.0",
    dimensions: 12,
    scoring: "1-100 per dimension, weighted overall",
    endpoint: "POST /api/audit",
    body: { subject_url: "string", subject_name: "string" },
    note: "Honest, impartial FAANG-grade scoring. No flattery."
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const subjectUrl = (body.subject_url as string) || (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000")
  const subjectName = (body.subject_name as string) || "Agent Zero"
  try {
    const report = await runIndependentAudit(subjectUrl, subjectName)
    return NextResponse.json(report)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
