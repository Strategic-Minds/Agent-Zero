/**
 * HOURLY OPTIMIZER CRON — /api/cron/optimize
 * DIRECTIVE 3: Auto-fix → Auto-heal → Auto-harden loop
 * Fires every hour. Reads audit. Picks top gap. Implements fix.
 * 
 * AI-PARALLEL TIME BUDGET (per run):
 *   Audit read:         0.8s
 *   Gap analysis:       1.2s  (Groq 800 tok/s)
 *   Code generation:    4-8s  (APEX TypeScript fix)
 *   GitHub push:        0.6s
 *   Reflection log:     0.3s
 *   TOTAL:             ~12s   (well within 60s maxDuration)
 *   Build happens async on Vercel — not blocked here
 */
import { NextRequest, NextResponse } from "next/server"
import { selectNextGap, getGapFix, logOptimizerRun, getAllGaps } from "@/agents/optimizer"
import { reflect } from "@/agents/reflection"
import { getSupabaseAdmin } from "@/lib/supabase"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

async function getCompletedGaps(): Promise<string[]> {
  try {
    const db = getSupabaseAdmin()
    const { data } = await db
      .from("optimizer_runs" as any)
      .select("gap_targeted")
      .eq("fix_applied", true)
    return (data || []).map((r: { gap_targeted: string }) => r.gap_targeted)
  } catch { return [] }
}

async function generateFix(gapKey: string, gapFix: ReturnType<typeof getGapFix>): Promise<{ code: string; filename: string } | null> {
  if (!gapFix) return null
  const groqKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY
  if (!groqKey) return null

  // Use Groq to generate the actual fix code
  const isGroq = !!process.env.GROQ_API_KEY
  const endpoint = isGroq
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions"
  const model = isGroq ? "llama-3.3-70b-versatile" : "gpt-4o-mini"

  const prompt = `You are Agent Zero's autonomous code fixer.

GAP TO FIX: ${gapFix.title}
FIX DESCRIPTION: ${gapFix.fix_description}
PRIMARY FILE: ${gapFix.files_to_patch[0] || "lib/fix.ts"}

Generate production-ready TypeScript code for this fix.
Requirements:
- Next.js 14 App Router compatible
- Works on Vercel serverless (no native binaries unless specified)
- Imports use @/ alias for project root
- Error handling with try/catch on all async operations
- Returns real data, never mocked or stubbed
- Exports named async functions

Respond with ONLY the TypeScript code, no explanation, no markdown fences.`

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(20000),
    })
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const code = data?.choices?.[0]?.message?.content || ""
    if (!code || code.length < 50) return null
    return { code: code.replace(/^```typescript\n?/, "").replace(/^```ts\n?/, "").replace(/```$/, "").trim(), filename: gapFix.files_to_patch[0] || "lib/fix.ts" }
  } catch { return null }
}

async function pushFixToGitHub(filename: string, code: string, gapTitle: string): Promise<boolean> {
  const token = process.env.GITHUB_TOKEN
  const repoName = process.env.GITHUB_REPO || "Strategic-Minds/Agent-Zero"
  if (!token) return false

  try {
    const b64 = Buffer.from(code).toString("base64")
    let sha = ""
    try {
      const existing = await fetch(`https://api.github.com/repos/${repoName}/contents/${filename}`, {
        headers: { "Authorization": `token ${token}` }
      })
      if (existing.ok) {
        const d = await existing.json() as { sha?: string }
        sha = d.sha || ""
      }
    } catch { /* new file */ }

    const payload: Record<string, string> = {
      message: `fix(optimizer): auto-fix ${gapTitle.slice(0, 60)}`,
      content: b64,
    }
    if (sha) payload.sha = sha

    const pushRes = await fetch(`https://api.github.com/repos/${repoName}/contents/${filename}`, {
      method: "PUT",
      headers: { "Authorization": `token ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    return pushRes.ok
  } catch { return false }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const secret = url.searchParams.get("secret") || req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "") || ""
  if (secret !== (process.env.CRON_SECRET || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  const run_id = `opt_${Date.now()}`
  const cycle = Math.floor(Date.now() / 3600000) // hour-based cycle

  // Step 1: Get audit score (quick check)
  let auditScoreBefore = 59 // baseline from last audit
  try {
    const auditRes = await fetch(`${process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "https://agent-zero-beta.vercel.app"}/api/audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: "agent-zero" }),
      signal: AbortSignal.timeout(15000),
    })
    if (auditRes.ok) {
      const auditData = await auditRes.json() as { overall_score?: number }
      auditScoreBefore = auditData.overall_score || 59
    }
  } catch { /* use baseline */ }

  // Step 2: Get completed gaps from Supabase
  const completedGaps = await getCompletedGaps()

  // Step 3: Select next highest-impact gap
  const nextGapKey = selectNextGap(completedGaps)
  if (!nextGapKey) {
    return NextResponse.json({
      ok: true,
      message: "All auto-fixable gaps completed! System at maximum autonomous capability.",
      completed_gaps: completedGaps.length,
      audit_score: auditScoreBefore,
      duration_ms: Date.now() - startTime,
    })
  }

  const gapFix = getGapFix(nextGapKey)!
  let fixApplied = false
  let buildTriggered = false

  // Step 4: Generate fix code via Groq (AI-parallel, ~4-8s)
  const generatedFix = await generateFix(nextGapKey, gapFix)

  // Step 5: Push fix to GitHub (triggers Vercel build automatically)
  if (generatedFix) {
    fixApplied = await pushFixToGitHub(generatedFix.filename, generatedFix.code, gapFix.title)
    buildTriggered = fixApplied
  }

  // Step 6: Determine next target
  const allGaps = getAllGaps()
  const remaining = Object.entries(allGaps)
    .filter(([key, g]) => g.auto_fixable && !completedGaps.includes(key) && key !== nextGapKey)
    .sort(([, a], [, b]) => b.impact - a.impact)
  const nextTarget = remaining.length > 0 ? remaining[0][1].title : "All gaps closed — system at 100%"

  const pointsGained = fixApplied ? gapFix.impact : 0
  const estimatedNewScore = Math.min(100, auditScoreBefore + (fixApplied ? Math.round(gapFix.impact * 0.7) : 0))
  const durationMs = Date.now() - startTime

  // Step 7: Log optimizer run
  const run = {
    run_id,
    cycle,
    audit_score_before: auditScoreBefore,
    audit_score_after: estimatedNewScore,
    gap_targeted: nextGapKey,
    fix_description: gapFix.fix_description,
    fix_applied: fixApplied,
    build_triggered: buildTriggered,
    validator_score_after: 0, // will be confirmed by next auto-validate run
    points_gained: pointsGained,
    ran_at: new Date().toISOString(),
    duration_ms: durationMs,
    next_target: nextTarget,
  }
  await logOptimizerRun(run)

  // Step 8: Write reflection
  await reflect({
    run_id,
    run_type: "optimize",
    agents_fired: 1,
    agents_succeeded: fixApplied ? 1 : 0,
    leads_discovered: 0,
  }).catch(() => null)

  const gapsRemaining = Object.values(allGaps).filter(g => g.auto_fixable).length - completedGaps.length - (fixApplied ? 1 : 0)
  const minutesToCompletion = gapsRemaining * 60 // 1 fix per hour

  return NextResponse.json({
    ok: true,
    run_id,
    cycle,
    gap_targeted: gapFix.title,
    fix_applied: fixApplied,
    build_triggered: buildTriggered,
    score_before: auditScoreBefore,
    score_after: estimatedNewScore,
    points_gained: pointsGained,
    gaps_remaining: gapsRemaining,
    estimated_completion: `${minutesToCompletion} minutes (${Math.ceil(minutesToCompletion/60)} hours)`,
    next_target: nextTarget,
    duration_ms: durationMs,
    timestamp: new Date().toISOString(),
  })
}
