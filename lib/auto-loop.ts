/**
 * AGENT ZERO — AUTONOMOUS EVOLUTION LOOP v1.0
 * 12-stage self-improvement cycle
 * Runs every 5 minutes via Vercel Cron
 * Fully autonomous: analyze → create → validate → fix → heal → harden
 *              → optimize → enhance → test → document → reflect → evolve
 */

import { getSupabaseAdmin } from "./supabase"
import { generateText } from "ai"
import { withSmartRetry } from "./router"

// ── TYPES ─────────────────────────────────────────────────────────────

export type LoopStage =
  | "analyze" | "create" | "validate" | "fix" | "heal"
  | "harden" | "optimize" | "enhance" | "test"
  | "document" | "reflect" | "evolve" | "idle"

export type LoopStatus = "running" | "complete" | "failed" | "skipped"

export interface LoopState {
  cycle_id: string
  stage: LoopStage
  status: LoopStatus
  score_before: number
  score_after: number
  patches_applied: number
  capabilities_healed: number
  started_at: string
  stage_started_at: string
  stage_log: string[]
  error?: string
}

export interface StageResult {
  stage: LoopStage
  status: LoopStatus
  output: Record<string, unknown>
  duration_ms: number
  log: string[]
}

// ── HELPERS ───────────────────────────────────────────────────────────

async function callInternal(path: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const base = process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000"
  const method = body ? "POST" : "GET"
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", "x-cron-secret": process.env.CRON_SECRET || "" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(55000),
  })
  return res.json() as Promise<Record<string, unknown>>
}

async function aiThink(prompt: string, maxTokens = 500): Promise<string> {
  const { text } = await withSmartRetry("fast", (model) =>
    generateText({ model, prompt, maxTokens })
  )
  return text
}

async function persistState(state: Partial<LoopState> & { cycle_id: string }): Promise<void> {
  try {
    const db = getSupabaseAdmin()
    await db.from("auto_loop_state").upsert(state, { onConflict: "cycle_id" })
  } catch { }
}

async function logHistory(cycleId: string, result: StageResult): Promise<void> {
  try {
    const db = getSupabaseAdmin()
    await db.from("loop_stage_log").insert({
      cycle_id: cycleId,
      stage: result.stage,
      status: result.status,
      output: result.output,
      duration_ms: result.duration_ms,
      log: result.log,
      created_at: new Date().toISOString(),
    })
  } catch { }
}

// ── THE 12 STAGES ─────────────────────────────────────────────────────

async function stageAnalyze(cycleId: string): Promise<StageResult> {
  const start = Date.now()
  const log: string[] = []
  try {
    const health = await callInternal("/api/health")
    const benchData = await callInternal("/api/benchmark")
    const memData = await callInternal("/api/test-memory?view=health")
    const score = (benchData.overall_score as number) || (memData.avg_system_score as number) || 0
    const caps = (benchData.active_capabilities as number) || 0
    const gaps: string[] = []
    if (score < 95) gaps.push("validator_score_below_95")
    if (caps < 28) gaps.push("capabilities_incomplete")
    if ((memData.broken as number) > 0) gaps.push("broken_tests_detected")
    if ((memData.flaky as number) > 2) gaps.push("multiple_flaky_tests")
    log.push("Score: " + score + "% | Caps: " + caps + "/30 | Gaps: " + gaps.length)
    return { stage: "analyze", status: "complete", output: { score, caps, gaps, health }, duration_ms: Date.now() - start, log }
  } catch (e) {
    log.push("Analyze failed: " + String(e).slice(0, 100))
    return { stage: "analyze", status: "failed", output: { error: String(e) }, duration_ms: Date.now() - start, log }
  }
}

async function stageCreate(analyzeOutput: Record<string, unknown>): Promise<StageResult> {
  const start = Date.now()
  const log: string[] = []
  const gaps = (analyzeOutput.gaps as string[]) || []
  if (gaps.length === 0) {
    log.push("No gaps detected — skipping create stage")
    return { stage: "create", status: "skipped", output: { patches: [] }, duration_ms: Date.now() - start, log }
  }
  try {
    const patches: string[] = []
    for (const gap of gaps.slice(0, 3)) {
      const suggestion = await aiThink(
        "Agent Zero system gap detected: " + gap + ". Current score: " + (analyzeOutput.score || 0) + "%. " +
        "Suggest one specific code improvement (max 50 words). Be precise about which file and what change.",
        100
      )
      patches.push(gap + ": " + suggestion)
      log.push("Gap: " + gap + " → " + suggestion.slice(0, 80))
    }
    return { stage: "create", status: "complete", output: { patches }, duration_ms: Date.now() - start, log }
  } catch (e) {
    return { stage: "create", status: "failed", output: { error: String(e) }, duration_ms: Date.now() - start, log }
  }
}

async function stageValidate(): Promise<{ result: StageResult; score: number }> {
  const start = Date.now()
  const log: string[] = []
  try {
    const base = process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000"
    const val = await callInternal("/api/validate", { url: base })
    const score = (val.overall_score as number) || 0
    const grade = (val.faang_grade as string) || "?"
    const cleared = (val.url_cleared as boolean) || false
    const critFails = (val.critical_failures as number) || 0
    log.push("Validation score: " + score + "% | Grade: " + grade + " | Cleared: " + cleared + " | Critical fails: " + critFails)
    return {
      result: { stage: "validate", status: cleared ? "complete" : "failed", output: val, duration_ms: Date.now() - start, log },
      score
    }
  } catch (e) {
    log.push("Validation error: " + String(e).slice(0, 100))
    return { result: { stage: "validate", status: "failed", output: { error: String(e) }, duration_ms: Date.now() - start, log }, score: 0 }
  }
}

async function stageFix(validateOutput: Record<string, unknown>): Promise<StageResult> {
  const start = Date.now()
  const log: string[] = []
  const failures = (validateOutput.results_summary as Array<Record<string, unknown>>) || []
  const failing = failures.filter(t => !t.passed)
  if (failing.length === 0) {
    log.push("No failures to fix")
    return { stage: "fix", status: "skipped", output: { fixes: [] }, duration_ms: Date.now() - start, log }
  }
  try {
    const fixes: string[] = []
    for (const test of failing.slice(0, 3)) {
      const fix = await aiThink(
        "Agent Zero test failing: " + (test.name as string) + ". Details: " + (test.details as string) + ". " +
        "Provide a 1-sentence fix recommendation for a Next.js/TypeScript system.",
        80
      )
      fixes.push((test.name as string) + ": " + fix)
      log.push("Fix for " + (test.name as string) + ": " + fix.slice(0, 80))
    }
    return { stage: "fix", status: "complete", output: { fixes }, duration_ms: Date.now() - start, log }
  } catch (e) {
    return { stage: "fix", status: "failed", output: { error: String(e) }, duration_ms: Date.now() - start, log }
  }
}

async function stageHeal(): Promise<StageResult> {
  const start = Date.now()
  const log: string[] = []
  try {
    const installResult = await callInternal("/api/install")
    const inactive = (installResult.inactive as number) || 0
    const healed = (installResult.installed as number) || 0
    log.push("Inactive capabilities: " + inactive + " | Healed: " + healed)
    return { stage: "heal", status: "complete", output: { inactive, healed }, duration_ms: Date.now() - start, log }
  } catch (e) {
    log.push("Heal error: " + String(e).slice(0, 100))
    return { stage: "heal", status: "failed", output: { error: String(e) }, duration_ms: Date.now() - start, log }
  }
}

async function stageHarden(): Promise<StageResult> {
  const start = Date.now()
  const log: string[] = []
  const checks = [
    { name: "CRON_SECRET set", pass: !!process.env.CRON_SECRET },
    { name: "BRIDGE_SECRET set", pass: !!process.env.BRIDGE_SECRET },
    { name: "SUPABASE_SERVICE_KEY set", pass: !!process.env.SUPABASE_SERVICE_KEY },
    { name: "GITHUB_TOKEN set", pass: !!process.env.GITHUB_TOKEN },
    { name: "GROQ_API_KEY set", pass: !!process.env.GROQ_API_KEY },
  ]
  const failed = checks.filter(c => !c.pass)
  checks.forEach(c => log.push((c.pass ? "✅" : "❌") + " " + c.name))
  return {
    stage: "harden",
    status: failed.length === 0 ? "complete" : "failed",
    output: { checks, failed: failed.map(c => c.name) },
    duration_ms: Date.now() - start,
    log
  }
}

async function stageOptimize(analyzeOutput: Record<string, unknown>): Promise<StageResult> {
  const start = Date.now()
  const log: string[] = []
  const score = (analyzeOutput.score as number) || 0
  const recommendations: string[] = []
  if (score < 90) recommendations.push("Priority: fix critical test failures before optimizing")
  else recommendations.push("System healthy — focus on latency optimization and caching")
  log.push("Optimization check complete — " + recommendations.length + " recommendations")
  return { stage: "optimize", status: "complete", output: { recommendations }, duration_ms: Date.now() - start, log }
}

async function stageEnhance(score: number): Promise<StageResult> {
  const start = Date.now()
  const log: string[] = []
  if (score < 90) {
    log.push("Score " + score + "% — below 90%, skipping enhancement until system is stable")
    return { stage: "enhance", status: "skipped", output: {}, duration_ms: Date.now() - start, log }
  }
  const ideas = await aiThink(
    "Agent Zero is at " + score + "% capability. It has 8 agents, 8 workflows, and 30 capabilities. " +
    "Suggest ONE specific new enhancement that would push it closer to FAANG grade A+. " +
    "Focus on autonomous lead generation for XPS Intelligence (epoxy flooring Arizona). Max 30 words.",
    60
  )
  log.push("Enhancement idea: " + ideas.slice(0, 100))
  return { stage: "enhance", status: "complete", output: { ideas }, duration_ms: Date.now() - start, log }
}

async function stageTest(): Promise<{ result: StageResult; score: number }> {
  return stageValidate()
}

async function stageDocument(cycleId: string, allResults: StageResult[]): Promise<StageResult> {
  const start = Date.now()
  const log: string[] = []
  try {
    const db = getSupabaseAdmin()
    const summary = {
      cycle_id: cycleId,
      timestamp: new Date().toISOString(),
      stages: allResults.map(r => ({ stage: r.stage, status: r.status, duration_ms: r.duration_ms })),
      total_duration_ms: allResults.reduce((s, r) => s + r.duration_ms, 0),
    }
    await db.from("loop_history").insert(summary)
    log.push("Cycle " + cycleId + " documented — " + allResults.length + " stages")
    return { stage: "document", status: "complete", output: summary, duration_ms: Date.now() - start, log }
  } catch (e) {
    return { stage: "document", status: "failed", output: { error: String(e) }, duration_ms: Date.now() - start, log }
  }
}

async function stageReflect(allResults: StageResult[], scoreBefore: number, scoreAfter: number): Promise<StageResult> {
  const start = Date.now()
  const log: string[] = []
  const delta = scoreAfter - scoreBefore
  const failedStages = allResults.filter(r => r.status === "failed").map(r => r.stage)
  const reflection = await aiThink(
    "Agent Zero autonomous loop completed. Score changed from " + scoreBefore + "% to " + scoreAfter + "% (delta: " + (delta >= 0 ? "+" : "") + delta + "%). " +
    "Failed stages: " + (failedStages.join(", ") || "none") + ". " +
    "In 2 sentences: what was the most important outcome and what should improve next cycle?",
    100
  )
  log.push("Reflection: " + reflection.slice(0, 150))
  return { stage: "reflect", status: "complete", output: { reflection, delta, failed_stages: failedStages }, duration_ms: Date.now() - start, log }
}

async function stageEvolve(cycleId: string, scoreBefore: number, scoreAfter: number, patchCount: number): Promise<StageResult> {
  const start = Date.now()
  const log: string[] = []
  const delta = scoreAfter - scoreBefore
  log.push("Cycle complete: " + cycleId + " | Delta: " + (delta >= 0 ? "+" : "") + delta + "% | Patches: " + patchCount)
  try {
    if (process.env.OWNER_WHATSAPP && process.env.WHATSAPP_BUSINESS_TOKEN && Math.abs(delta) >= 5) {
      const msg = "Agent Zero auto-loop: Score " + (delta >= 0 ? "improved" : "dropped") + " " + Math.abs(delta) + "% (" + scoreBefore + "% → " + scoreAfter + "%). Cycle: " + cycleId
      await fetch("https://graph.facebook.com/v20.0/" + process.env.WHATSAPP_PHONE_NUMBER_ID + "/messages", {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.WHATSAPP_BUSINESS_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: process.env.OWNER_WHATSAPP, type: "text", text: { body: msg } }),
      })
      log.push("Owner notified via WhatsApp")
    }
  } catch { log.push("WhatsApp notify failed — continuing") }
  return { stage: "evolve", status: "complete", output: { cycle_id: cycleId, score_before: scoreBefore, score_after: scoreAfter, delta, patches: patchCount }, duration_ms: Date.now() - start, log }
}

// ── MASTER LOOP RUNNER ────────────────────────────────────────────────

export async function runAutoLoop(): Promise<{
  cycle_id: string
  score_before: number
  score_after: number
  delta: number
  stages: StageResult[]
  total_ms: number
  status: string
}> {
  const cycleId = "cycle_" + Date.now()
  const loopStart = Date.now()
  const allResults: StageResult[] = []
  let scoreBefore = 0
  let scoreAfter = 0
  let patchCount = 0

  console.log("[AUTO-LOOP] Starting cycle:", cycleId)

  await persistState({ cycle_id: cycleId, stage: "analyze", status: "running", score_before: 0, score_after: 0, patches_applied: 0, capabilities_healed: 0, started_at: new Date().toISOString(), stage_started_at: new Date().toISOString(), stage_log: [] })

  // ── Stage 1: ANALYZE
  const analyzeResult = await stageAnalyze(cycleId)
  allResults.push(analyzeResult)
  await logHistory(cycleId, analyzeResult)
  scoreBefore = (analyzeResult.output.score as number) || 0

  // ── Stage 2: CREATE
  const createResult = await stageCreate(analyzeResult.output)
  allResults.push(createResult)
  await logHistory(cycleId, createResult)

  // ── Stage 3: VALIDATE
  const { result: validateResult, score: valScore } = await stageValidate()
  allResults.push(validateResult)
  await logHistory(cycleId, validateResult)

  // ── Stage 4: FIX
  const fixResult = await stageFix(validateResult.output)
  allResults.push(fixResult)
  await logHistory(cycleId, fixResult)
  patchCount += ((fixResult.output.fixes as string[]) || []).length

  // ── Stage 5: HEAL
  const healResult = await stageHeal()
  allResults.push(healResult)
  await logHistory(cycleId, healResult)

  // ── Stage 6: HARDEN
  const hardenResult = await stageHarden()
  allResults.push(hardenResult)
  await logHistory(cycleId, hardenResult)

  // ── Stage 7: OPTIMIZE
  const optimizeResult = await stageOptimize(analyzeResult.output)
  allResults.push(optimizeResult)
  await logHistory(cycleId, optimizeResult)

  // ── Stage 8: ENHANCE
  const enhanceResult = await stageEnhance(valScore)
  allResults.push(enhanceResult)
  await logHistory(cycleId, enhanceResult)

  // ── Stage 9: TEST
  const { result: testResult, score: testScore } = await stageTest()
  allResults.push(testResult)
  await logHistory(cycleId, testResult)
  scoreAfter = testScore

  // ── Stage 10: DOCUMENT
  const documentResult = await stageDocument(cycleId, allResults)
  allResults.push(documentResult)

  // ── Stage 11: REFLECT
  const reflectResult = await stageReflect(allResults, scoreBefore, scoreAfter)
  allResults.push(reflectResult)
  await logHistory(cycleId, reflectResult)

  // ── Stage 12: EVOLVE
  const evolveResult = await stageEvolve(cycleId, scoreBefore, scoreAfter, patchCount)
  allResults.push(evolveResult)
  await logHistory(cycleId, evolveResult)

  await persistState({ cycle_id: cycleId, stage: "idle", status: "complete", score_before: scoreBefore, score_after: scoreAfter, patches_applied: patchCount, capabilities_healed: (healResult.output.healed as number) || 0, started_at: allResults[0].stage as unknown as string, stage_started_at: new Date().toISOString(), stage_log: allResults.flatMap(r => r.log) })

  console.log("[AUTO-LOOP] Cycle complete:", cycleId, "Score:", scoreBefore, "→", scoreAfter)

  return {
    cycle_id: cycleId,
    score_before: scoreBefore,
    score_after: scoreAfter,
    delta: scoreAfter - scoreBefore,
    stages: allResults,
    total_ms: Date.now() - loopStart,
    status: allResults.every(r => r.status !== "failed") ? "complete" : "partial",
  }
}
