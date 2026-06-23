/**
 * OPTIMIZER CRON — Read-only mode
 * Monitors system health. Does NOT push code to GitHub.
 * Code changes are handled by the XPS Agent directly.
 */
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET() {
  const base = process.env.VERCEL_URL
    ? "https://" + process.env.VERCEL_URL
    : "https://agent-zero-3lr4yymi9-strategic-minds-advisory.vercel.app"

  // Read-only health check — no code pushes
  let validator_score = 0
  let audit_score = 0

  try {
    const v = await fetch(base + "/api/validate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: base }), signal: AbortSignal.timeout(20000)
    })
    const vd = await v.json() as { score?: number }
    validator_score = vd.score || 0
  } catch { /* non-fatal */ }

  try {
    const a = await fetch(base + "/api/audit", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: "agent-zero" }), signal: AbortSignal.timeout(20000)
    })
    const ad = await a.json() as { overall_score?: number }
    audit_score = ad.overall_score || 0
  } catch { /* non-fatal */ }

  return NextResponse.json({
    ok: true,
    mode: "read_only",
    note: "Code changes handled by XPS Agent — this cron monitors only",
    validator_score,
    audit_score,
    timestamp: new Date().toISOString(),
  })
}
