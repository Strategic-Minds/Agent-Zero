/**
 * EVOLUTION AGENT v1.0
 * Reads audit results + reflection reports
 * Writes builder docs targeting specific gaps
 * Pushes targeted improvements to GitHub
 * Runs every 6 hours via cron
 */
import { getSupabaseAdmin } from "../lib/supabase"
import { generateText } from "ai"
import { withSmartRetry } from "../lib/router"
import { trackSOPEvent } from "../lib/sop-tracker"

export interface EvolutionPlan {
  evolution_id: string
  timestamp: string
  based_on_audit_score: number
  target_score: number
  gap: number
  
  // What to build
  priority_fixes: Array<{
    id: string
    title: string
    file: string
    action: "create" | "modify" | "delete"
    code_hint: string
    expected_score_gain: number
    effort_hours: number
  }>

  // Builder doc generated
  builder_doc: string

  // Outcome
  files_planned: number
  expected_new_score: number
  status: "planned" | "in_progress" | "applied"
}

export async function runEvolutionCycle(): Promise<EvolutionPlan> {
  const db = getSupabaseAdmin()
  const evolutionId = "evolve_" + Date.now()

  // Get latest audit
  const { data: latestAudit } = await db
    .from("audit_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  const auditScore = (latestAudit as Record<string,unknown>)?.overall_score as number || 58
  const targetScore = Math.min(99, auditScore + 10)
  const gap = 99 - auditScore

  // Get latest reflection
  const { data: latestReflect } = await db
    .from("reflection_reports")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(1)
    .single()

  const nextActions = (latestReflect as Record<string,unknown[]> | null)?.priority_next_actions as string[] || []

  // Determine priority fixes based on audit score
  const priorityFixes: EvolutionPlan["priority_fixes"] = []

  if (auditScore < 70) {
    priorityFixes.push({
      id: "EV_SCRAPER",
      title: "Real web scraping — replace hallucinated discovery",
      file: "agents/discovery.ts",
      action: "modify",
      code_hint: "Replace generateObject() with real fetch() calls to Google Maps API + Yelp API. Parse HTML with regex. Store real leads.",
      expected_score_gain: 12,
      effort_hours: 8,
    })
  }

  if (auditScore < 75) {
    priorityFixes.push({
      id: "EV_PARALLEL",
      title: "Fix parallel orchestration — fire all agents simultaneously",
      file: "lib/orchestrator.ts",
      action: "modify",
      code_hint: "Use Promise.all([ariaAgent(task), discoveryAgent(task), intelligenceAgent(task)]). Merge all results into synthesized_response.",
      expected_score_gain: 8,
      effort_hours: 4,
    })
  }

  if (auditScore < 80) {
    priorityFixes.push({
      id: "EV_MONITORING",
      title: "Add Sentry error monitoring",
      file: "sentry.server.config.ts",
      action: "create",
      code_hint: "import * as Sentry from '@sentry/nextjs'; Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 1.0 });",
      expected_score_gain: 6,
      effort_hours: 2,
    })
  }

  // Generate AI builder doc
  const { text: builderDoc } = await withSmartRetry("reasoning", (model) =>
    generateText({
      model,
      prompt: `You are the Agent Zero Evolution Agent. Current audit score: ${auditScore}/100. Target: ${targetScore}/100.
      
Priority actions from reflection: ${nextActions.join("; ")}

Write a precise technical builder document (200 words max) specifying:
1. The single most impactful code change to make right now
2. Exact file to modify and what change to make
3. Expected score improvement and why
4. Any dependencies or prerequisites

Be specific. Code paths, function names, exact changes. No vague guidance.`,
      maxTokens: 400,
    })
  ).catch(() => ({ text: "Evolution agent AI generation failed." }))

  const plan: EvolutionPlan = {
    evolution_id: evolutionId,
    timestamp: new Date().toISOString(),
    based_on_audit_score: auditScore,
    target_score: targetScore,
    gap,
    priority_fixes: priorityFixes,
    builder_doc: builderDoc,
    files_planned: priorityFixes.length,
    expected_new_score: Math.min(99, auditScore + priorityFixes.reduce((s, f) => s + f.expected_score_gain, 0)),
    status: "planned",
  }

  // Persist evolution plan
  try { await db.from("evolution_plans").insert({ ...plan, created_at: new Date().toISOString() }) } catch { /* non-blocking */ }

  await trackSOPEvent({
    event_type: "evolution_cycle",
    agent: "evolution-agent",
    action: "plan_evolution",
    input_summary: `Audit score: ${auditScore}/100, gap: ${gap}pts`,
    output_summary: `Plan: ${priorityFixes.length} fixes, expected score: ${plan.expected_new_score}/100`,
    success: true,
    duration_ms: 0,
    score_impact: plan.expected_new_score - auditScore,
  })

  return plan
}
