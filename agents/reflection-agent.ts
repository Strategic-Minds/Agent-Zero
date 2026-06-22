/**
 * SELF REFLECTION AGENT v1.0
 * Runs every 4 hours via Vercel Cron
 * Reviews: audit score, SOP summary, test memory, loop history
 * Generates honest self-assessment with improvement priorities
 * Feeds into evolution agent
 */
import { getSupabaseAdmin } from "../lib/supabase"
import { generateText } from "ai"
import { withSmartRetry } from "../lib/router"
import { generateSOPSummary, trackSOPEvent } from "../lib/sop-tracker"

export interface ReflectionReport {
  reflection_id: string
  timestamp: string
  period_hours: number

  // Current state
  current_audit_score: number
  current_faang_grade: string
  test_pass_rate: number

  // SOP summary
  sop_summary: {
    total_events: number
    success_rate: number
    trend: string
    key_outcomes: string[]
    anomalies: string[]
  }

  // AI reflection
  honest_assessment: string
  what_worked: string[]
  what_failed: string[]
  patterns_detected: string[]
  priority_next_actions: string[]

  // Evolution signal
  evolution_needed: boolean
  evolution_urgency: "critical" | "high" | "medium" | "low"
  suggested_builder_focus: string
}

export async function runSelfReflection(periodHours = 4): Promise<ReflectionReport> {
  const db = getSupabaseAdmin()
  const reflectionId = "reflect_" + Date.now()
  const timestamp = new Date().toISOString()

  // Gather data in parallel
  const [sopSummary, testMemory, loopHistory, latestAudit] = await Promise.all([
    generateSOPSummary(periodHours).catch(() => null),
    db.from("test_memory").select("test_id,last_status,pass_rate,is_flaky,consecutive_fails").limit(30).then(r => r.data || []),
    db.from("loop_history").select("*").order("timestamp", { ascending: false }).limit(5).then(r => r.data || []),
    db.from("audit_reports").select("overall_score,faang_grade,p0_count,p1_count,dimension_scores").order("created_at", { ascending: false }).limit(1).single().then(r => r.data || null),
  ])

  const auditScore = (latestAudit as Record<string,unknown>)?.overall_score as number || 58
  const faangGrade = (latestAudit as Record<string,unknown>)?.faang_grade as string || "D"
  const testPasses = (testMemory as Array<Record<string,unknown>>).filter((t) => t.last_status === "pass").length
  const testPassRate = testMemory.length > 0 ? Math.round((testPasses / testMemory.length) * 100) : 0
  const successRate = sopSummary ? Math.round((sopSummary.successful_events / Math.max(sopSummary.total_events, 1)) * 100) : 100

  // Generate AI self-reflection
  const context = `
Agent Zero Self-Reflection Context:
- Current audit score: ${auditScore}/100 (Grade ${faangGrade})
- Test pass rate: ${testPassRate}%
- SOP success rate: ${successRate}%
- Events in last ${periodHours}h: ${sopSummary?.total_events || 0}
- Key outcomes: ${(sopSummary?.key_outcomes || []).join(", ")}
- Anomalies: ${(sopSummary?.anomalies || []).join(", ") || "none"}
- Failed tests: ${(testMemory as Array<Record<string,unknown>>).filter(t => t.last_status === "fail").map(t => t.test_id).join(", ") || "none"}
- Loop cycles completed: ${loopHistory.length}
- Known gaps: hallucinated lead discovery, no Playwright, parallel orchestration broken, no vector memory
`

  const { text: aiReflection } = await withSmartRetry("reasoning", (model) =>
    generateText({
      model,
      prompt: context + "As Agent Zero, write an honest 3-paragraph self-reflection: 1. What is working well right now 2. What is broken or underperforming and why it matters 3. The single most important thing to fix in the next cycle Be brutally honest. No flattery. Max 200 words.",
      maxTokens: 300,
    })
  ).catch(() => ({ text: "Reflection generation failed — system is operating but AI reflection unavailable." }))

  const whatWorked: string[] = []
  const whatFailed: string[] = []
  const patterns: string[] = []
  const nextActions: string[] = []

  if (testPassRate >= 90) whatWorked.push(`Test suite: ${testPassRate}% pass rate`)
  if (successRate >= 90) whatWorked.push(`Operations: ${successRate}% success rate`)
  if (loopHistory.length > 0) whatWorked.push(`Autonomous loop: ${loopHistory.length} cycles completed`)

  if (auditScore < 70) whatFailed.push(`Audit score ${auditScore}/100 — well below FAANG target`)
  const failedTests = (testMemory as Array<Record<string,unknown>>).filter(t => t.last_status === "fail")
  if (failedTests.length > 0) whatFailed.push(`${failedTests.length} tests failing: ${failedTests.slice(0,3).map(t => t.test_id).join(", ")}`)
  const flakyTests = (testMemory as Array<Record<string,unknown>>).filter(t => t.is_flaky)
  if (flakyTests.length > 0) patterns.push(`${flakyTests.length} flaky tests detected — intermittent failures`)

  if (auditScore < 70) nextActions.push("Fix P0: Replace hallucinated discovery with real web scraping")
  if (auditScore < 80) nextActions.push("Fix P0: Install Playwright-core for real browser automation")
  nextActions.push("Fix P1: Wire parallel orchestration to fire all agents simultaneously")

  const evolutionNeeded = auditScore < 85 || whatFailed.length > 2
  const evolutionUrgency: ReflectionReport["evolution_urgency"] =
    auditScore < 60 ? "critical" : auditScore < 75 ? "high" : auditScore < 85 ? "medium" : "low"

  const report: ReflectionReport = {
    reflection_id: reflectionId,
    timestamp,
    period_hours: periodHours,
    current_audit_score: auditScore,
    current_faang_grade: faangGrade,
    test_pass_rate: testPassRate,
    sop_summary: {
      total_events: sopSummary?.total_events || 0,
      success_rate: successRate,
      trend: sopSummary?.system_health_trend || "stable",
      key_outcomes: sopSummary?.key_outcomes || [],
      anomalies: sopSummary?.anomalies || [],
    },
    honest_assessment: aiReflection,
    what_worked: whatWorked,
    what_failed: whatFailed,
    patterns_detected: patterns,
    priority_next_actions: nextActions,
    evolution_needed: evolutionNeeded,
    evolution_urgency: evolutionUrgency,
    suggested_builder_focus: nextActions[0] || "Maintain current stability",
  }

  // Persist
  try { await db.from("reflection_reports").upsert({ ...report, created_at: timestamp }, { onConflict: "reflection_id" }) } catch { /* non-blocking */ }

  await trackSOPEvent({
    event_type: "reflection_completed",
    agent: "reflection-agent",
    action: "self_reflect",
    input_summary: `${periodHours}h period, audit score ${auditScore}`,
    output_summary: `Reflection complete. Evolution urgency: ${evolutionUrgency}. ${nextActions[0] || "No critical actions"}`,
    success: true,
    duration_ms: 0,
  })

  return report
}
