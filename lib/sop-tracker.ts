/**
 * AUTO SOP SYSTEM — Standard Operating Procedure Tracker
 * Tracks everything that happens in Agent Zero
 * Normalizes into human-readable summaries
 * Runs every 4 hours, emails to Jeremy
 */
import { getSupabaseAdmin } from "./supabase"

export type SOPEventType =
  | "agent_action" | "cron_run" | "validation_run" | "audit_run"
  | "lead_discovered" | "lead_scored" | "outreach_sent" | "error_occurred"
  | "capability_healed" | "code_pushed" | "deploy_triggered" | "reflection_completed"
  | "evolution_cycle" | "email_sent" | "loop_cycle"

export interface SOPEvent {
  event_id: string
  event_type: SOPEventType
  agent: string
  action: string
  input_summary: string
  output_summary: string
  success: boolean
  duration_ms: number
  score_impact?: number
  metadata?: Record<string, unknown>
  timestamp: string
}

export interface SOPSummary {
  period_start: string
  period_end: string
  total_events: number
  successful_events: number
  failed_events: number
  events_by_type: Record<string, number>
  top_agents: Array<{ agent: string; count: number; success_rate: number }>
  key_outcomes: string[]
  anomalies: string[]
  system_health_trend: "improving" | "stable" | "degrading"
  narrative: string
}

// Track any event
export async function trackSOPEvent(event: Omit<SOPEvent, "event_id" | "timestamp">): Promise<void> {
  try {
    const db = getSupabaseAdmin()
    await db.from("sop_events").insert({
      event_id: "sop_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      ...event,
      timestamp: new Date().toISOString(),
    })
  } catch { /* non-blocking */ }
}

// Generate 4-hour summary
export async function generateSOPSummary(hours = 4): Promise<SOPSummary> {
  const db = getSupabaseAdmin()
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  const { data: events } = await db
    .from("sop_events")
    .select("*")
    .gte("timestamp", since)
    .order("timestamp", { ascending: false })
    .limit(500)

  const evts = (events || []) as SOPEvent[]
  const total = evts.length
  const successful = evts.filter(e => e.success).length
  const failed = total - successful

  // Group by type
  const byType: Record<string, number> = {}
  for (const e of evts) byType[e.event_type] = (byType[e.event_type] || 0) + 1

  // Group by agent
  const agentMap: Record<string, { count: number; success: number }> = {}
  for (const e of evts) {
    if (!agentMap[e.agent]) agentMap[e.agent] = { count: 0, success: 0 }
    agentMap[e.agent].count++
    if (e.success) agentMap[e.agent].success++
  }
  const topAgents = Object.entries(agentMap)
    .map(([agent, s]) => ({ agent, count: s.count, success_rate: Math.round((s.success / s.count) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const keyOutcomes: string[] = []
  const leadsFound = byType["lead_discovered"] || 0
  const validations = byType["validation_run"] || 0
  const errors = byType["error_occurred"] || 0
  const cycles = byType["loop_cycle"] || 0

  if (leadsFound > 0) keyOutcomes.push(`${leadsFound} leads discovered`)
  if (validations > 0) keyOutcomes.push(`${validations} validation runs completed`)
  if (cycles > 0) keyOutcomes.push(`${cycles} autonomous evolution cycles`)
  if (errors > 0) keyOutcomes.push(`${errors} errors occurred (review needed)`)
  if (keyOutcomes.length === 0) keyOutcomes.push("System operating in maintenance mode")

  const anomalies: string[] = []
  const errorRate = total > 0 ? (failed / total) : 0
  if (errorRate > 0.2) anomalies.push(`High error rate: ${Math.round(errorRate * 100)}% of actions failed`)
  if (cycles === 0 && hours >= 1) anomalies.push("Auto-loop may not have run in this period")

  const healthTrend: "improving" | "stable" | "degrading" =
    errorRate < 0.05 ? "improving" : errorRate < 0.15 ? "stable" : "degrading"

  const narrative = `In the last ${hours} hours, Agent Zero executed ${total} tracked actions across ${Object.keys(agentMap).length} agents. ` +
    `Success rate: ${total > 0 ? Math.round((successful / total) * 100) : 100}%. ` +
    `${keyOutcomes.join(". ")}. ` +
    `System health trend: ${healthTrend.toUpperCase()}. ` +
    (anomalies.length > 0 ? `⚠️ Anomalies: ${anomalies.join("; ")}.` : "No anomalies detected.")

  return {
    period_start: since,
    period_end: new Date().toISOString(),
    total_events: total,
    successful_events: successful,
    failed_events: failed,
    events_by_type: byType,
    top_agents: topAgents,
    key_outcomes: keyOutcomes,
    anomalies,
    system_health_trend: healthTrend,
    narrative,
  }
}
