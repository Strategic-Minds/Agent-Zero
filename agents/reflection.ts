/**
 * INDEPENDENT SELF-REFLECTION SYSTEM — agents/reflection.ts
 * After every major run: what worked, what didn't, what to change
 * Writes findings to Supabase. Informs evolution engine.
 * Completely autonomous — no human needed.
 */

import { getSupabaseAdmin } from "../lib/supabase"

export interface ReflectionEntry {
  run_id: string
  run_type: string
  timestamp: string
  what_worked: string[]
  what_failed: string[]
  unexpected_findings: string[]
  recommendations: string[]
  metrics: Record<string, number | string>
  priority_actions: string[]
  overall_health_score: number
}

export async function reflect(runData: {
  run_id: string
  run_type: string
  agents_fired?: number
  agents_succeeded?: number
  leads_discovered?: number
  leads_scored?: number
  validator_score?: number
  errors?: string[]
  latency_ms?: number
  custom_data?: Record<string, unknown>
}): Promise<ReflectionEntry> {

  const successRate = runData.agents_fired && runData.agents_succeeded
    ? Math.round((runData.agents_succeeded / runData.agents_fired) * 100) : 100

  const what_worked: string[] = []
  const what_failed: string[] = []
  const recommendations: string[] = []
  const unexpected: string[] = []

  // Analyze what worked
  if (successRate >= 90) what_worked.push(`${successRate}% agent success rate — excellent parallel execution`)
  if ((runData.leads_discovered || 0) > 10) what_worked.push(`${runData.leads_discovered} leads discovered — scraper performing`)
  if ((runData.validator_score || 0) >= 90) what_worked.push(`Validator score ${runData.validator_score}/100 — deployment healthy`)
  if ((runData.latency_ms || 0) < 5000) what_worked.push(`Fast execution: ${runData.latency_ms}ms`)

  // Analyze failures
  if (successRate < 80) {
    what_failed.push(`Agent success rate ${successRate}% — below 80% threshold`)
    recommendations.push("Investigate failing agents — check Groq rate limits and Supabase connectivity")
  }
  if ((runData.leads_discovered || 0) === 0) {
    what_failed.push("Zero leads discovered — scraper may be blocked or API keys missing")
    recommendations.push("Check GOOGLE_MAPS_API_KEY and YELP_API_KEY environment variables")
  }
  if ((runData.validator_score || 0) < 80 && runData.validator_score !== undefined) {
    what_failed.push(`Validator score ${runData.validator_score}/100 — below acceptable threshold`)
    recommendations.push("Run APEX engine to auto-fix failing routes")
  }
  if (runData.errors && runData.errors.length > 0) {
    what_failed.push(...runData.errors.slice(0, 3).map(e => `Error: ${e.slice(0, 100)}`))
    recommendations.push("Check error logs in Vercel dashboard — trigger self-heal")
  }

  // Unexpected findings
  if ((runData.leads_discovered || 0) > 50) unexpected.push(`High lead volume: ${runData.leads_discovered} — may need to increase scoring capacity`)
  if ((runData.latency_ms || 0) > 30000) unexpected.push(`High latency: ${runData.latency_ms}ms — check Vercel cold starts`)

  // Priority actions
  const priority_actions: string[] = []
  if (what_failed.length > 0) priority_actions.push("🔴 Fix critical failures before next run")
  if (recommendations.length > 0) priority_actions.push(...recommendations.slice(0, 3))
  if (what_worked.length > 2) priority_actions.push("🟢 System healthy — continue autonomous operation")

  const health_score = Math.min(100, Math.max(0,
    (successRate * 0.4) +
    ((runData.validator_score || 70) * 0.3) +
    ((runData.leads_discovered || 0) > 0 ? 20 : 0) +
    (what_failed.length === 0 ? 10 : 0)
  ))

  const entry: ReflectionEntry = {
    run_id: runData.run_id,
    run_type: runData.run_type,
    timestamp: new Date().toISOString(),
    what_worked,
    what_failed,
    unexpected_findings: unexpected,
    recommendations,
    metrics: {
      success_rate: successRate,
      leads_discovered: runData.leads_discovered || 0,
      validator_score: runData.validator_score || 0,
      latency_ms: runData.latency_ms || 0,
      agents_fired: runData.agents_fired || 0,
    },
    priority_actions,
    overall_health_score: Math.round(health_score),
  }

  // Persist to Supabase
  try {
    const db = getSupabaseAdmin()
    await db.from("agent_reflections").upsert({
      run_id: entry.run_id,
      run_type: entry.run_type,
      health_score: entry.overall_health_score,
      what_worked: JSON.stringify(entry.what_worked),
      what_failed: JSON.stringify(entry.what_failed),
      recommendations: JSON.stringify(entry.recommendations),
      priority_actions: JSON.stringify(entry.priority_actions),
      metrics: JSON.stringify(entry.metrics),
      created_at: entry.timestamp,
    })
  } catch { /* non-fatal — reflection always returns even if DB write fails */ }

  return entry
}

// Format reflection for email/WhatsApp report
export function formatReflectionReport(r: ReflectionEntry): string {
  const lines = [
    `🔍 SELF-REFLECTION REPORT — ${r.run_type}`,
    `Health Score: ${r.overall_health_score}/100`,
    ``,
    r.what_worked.length > 0 ? `✅ What Worked:\n${r.what_worked.map(w => `  • ${w}`).join('\n')}` : '',
    r.what_failed.length > 0 ? `❌ What Failed:\n${r.what_failed.map(f => `  • ${f}`).join('\n')}` : '',
    r.priority_actions.length > 0 ? `⚡ Priority Actions:\n${r.priority_actions.map(a => `  • ${a}`).join('\n')}` : '',
  ]
  return lines.filter(Boolean).join('\n')
}
