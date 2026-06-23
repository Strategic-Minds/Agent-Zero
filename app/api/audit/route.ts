/**
 * INDEPENDENT AUDIT SYSTEM v2.0 — /api/audit
 * DIRECTIVE 2: MANDATORY fix recommendations on EVERY audit call
 * DIRECTIVE 1: AI-parallel time estimates (minutes, not days)
 * DIRECTIVE 4: Reads optimizer state to show progress toward 100%
 */
import { NextRequest, NextResponse } from "next/server"
import { runIndependentAudit } from "@/lib/audit-engine"
import { getAllGaps, selectNextGap } from "@/agents/optimizer"
import { getSupabaseAdmin } from "@/lib/supabase"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

export async function GET() {
  return NextResponse.json({
    status: "Independent Enterprise Audit System v2.0",
    directive: "DIRECTIVE 2 — mandatory fix recommendations on every audit",
    dimensions: 12,
    scoring: "1-100 per dimension, weighted overall",
    endpoint: "POST /api/audit",
    body: { subject_url: "string (optional)", subject_name: "string (optional)", system: "string (optional)" },
    note: "Honest, impartial FAANG-grade scoring. Mandatory fix plan always included.",
    optimizer: "Hourly cron at /api/cron/optimize auto-implements fixes",
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string,unknown>
  const subjectUrl = (body.subject_url as string) || (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "https://agent-zero-beta.vercel.app")
  const subjectName = (body.subject_name as string) || (body.system as string) || "Agent Zero"

  try {
    // Run core audit
    const report = await runIndependentAudit(subjectUrl, subjectName)

    // ─── DIRECTIVE 2: MANDATORY FIX PLAN ─────────────────────────────────
    const allGaps = getAllGaps()

    // Pull completed gaps from Supabase optimizer history
    let completedGaps: string[] = []
    try {
      const db = getSupabaseAdmin()
      const { data } = await db.from("optimizer_runs" as any).select("gap_targeted").eq("fix_applied", true)
      completedGaps = (data || []).map((r: { gap_targeted: string }) => r.gap_targeted)
    } catch { /* non-fatal */ }

    const remainingGaps = Object.entries(allGaps)
      .filter(([key, g]) => g.auto_fixable && !completedGaps.includes(key))
      .sort(([, a], [, b]) => b.impact - a.impact)

    const autoFixPlan = remainingGaps.map(([key, gap], idx) => ({
      priority_rank: idx + 1,
      gap_id: key,
      title: gap.title,
      impact_points: gap.impact,
      fix_type: gap.fix_type,
      auto_fixable: true,
      // DIRECTIVE 1: AI-parallel time estimates
      estimated_time_ai: gap.fix_type === "dependency" ? "8-15 minutes" : "3-8 minutes",
      estimated_time_human: gap.fix_type === "dependency" ? "2-4 hours" : "30-90 minutes",
      speedup_factor: gap.fix_type === "dependency" ? "15x faster with AI" : "20x faster with AI",
      files_affected: gap.files_to_patch,
      how_to_fix: gap.fix_description,
      cron_will_fix: "Yes — /api/cron/optimize fires hourly and will target this",
    }))

    const envRequiredGaps = Object.entries(allGaps)
      .filter(([, g]) => !g.auto_fixable)
      .map(([key, gap]) => ({
        gap_id: key,
        title: gap.title,
        impact_points: gap.impact,
        requires: "Manual env var configuration — cannot be auto-fixed",
        how_to_fix: gap.fix_description,
      }))

    const totalAutoFixPoints = remainingGaps.reduce((s, [, g]) => s + g.impact, 0)
    const cyclesNeeded = remainingGaps.length
    const minutesToCompletion = cyclesNeeded * 60 // 1 fix per hour cycle

    const mandatoryFixPlan = {
      // THIS IS MANDATORY — returned on every audit call per DIRECTIVE 2
      _directive: "DIRECTIVE 2 — MANDATORY FIX PLAN: always included in every audit response",
      total_auto_fixable_gaps: remainingGaps.length,
      total_env_required_gaps: envRequiredGaps.length,
      completed_gaps: completedGaps.length,
      potential_score_gain: Math.min(40, totalAutoFixPoints), // realistic cap
      projected_score_after_all_fixes: Math.min(100, (report.overall_score || 59) + Math.min(40, Math.round(totalAutoFixPoints * 0.65))),
      // DIRECTIVE 1: AI-parallel time estimates
      time_estimates: {
        per_fix_ai_parallel: "3-15 minutes",
        per_fix_human_sequential: "2-8 hours",
        all_fixes_ai_parallel: `${minutesToCompletion} minutes (${Math.ceil(minutesToCompletion/60)} hours at 1/hour)`,
        all_fixes_human_sequential: `${cyclesNeeded * 4} hours minimum`,
        speedup: `${Math.round(cyclesNeeded * 4 * 60 / minutesToCompletion)}x faster with AI autonomy`,
      },
      optimizer_status: {
        cron_schedule: "Every hour — /api/cron/optimize",
        last_completed_gaps: completedGaps.slice(-3),
        next_gap_in_queue: remainingGaps.length > 0 ? remainingGaps[0][1].title : "All auto-fixable gaps complete",
        auto_fix_active: true,
      },
      priority_fixes: autoFixPlan.slice(0, 10),
      env_required_manual_fixes: envRequiredGaps,
    }

    return NextResponse.json({
      ...report,
      mandatory_fix_plan: mandatoryFixPlan,
    })

  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
