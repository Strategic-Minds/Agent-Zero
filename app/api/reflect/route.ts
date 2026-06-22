import { NextRequest, NextResponse } from "next/server"
import { reflect, formatReflectionReport } from "@/agents/reflection"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const result = await reflect({
    run_id: String(body.run_id || "manual_" + Date.now()),
    run_type: String(body.run_type || "manual"),
    agents_fired: Number(body.agents_fired) || undefined,
    agents_succeeded: Number(body.agents_succeeded) || undefined,
    leads_discovered: Number(body.leads_discovered) || undefined,
    validator_score: Number(body.validator_score) || undefined,
    errors: Array.isArray(body.errors) ? body.errors as string[] : undefined,
  })
  return NextResponse.json({ ok: true, result, formatted: formatReflectionReport(result) })
}

export async function GET() {
  return NextResponse.json({ agent: "Self-Reflection System", description: "POST with run data to generate reflection entry" })
}
