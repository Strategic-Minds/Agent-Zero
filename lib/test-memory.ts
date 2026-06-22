/**
 * TEST MEMORY SYSTEM — Agent Zero v1.0
 *
 * Persistent memory for every test run, result, failure pattern,
 * known fix, and regression. Stored in Supabase.
 * 
 * Features:
 *   - Per-test pass/fail history with full context
 *   - Flaky test detection (passes sometimes, fails sometimes)
 *   - Known failure patterns + auto-suggested fixes
 *   - Regression detection (was passing, now failing)
 *   - Score trend tracking across deployments
 *   - In-memory LRU cache for fast lookups during test runs
 */

import { getSupabaseAdmin } from "./supabase"

// ── TYPES ─────────────────────────────────────────────────────────────────

export type TestStatus = "pass" | "fail" | "flaky" | "skip" | "error"
export type TestSeverity = "critical" | "high" | "medium" | "low"

export interface TestResult {
  test_id: string           // e.g. "api_01", "comm_02", "e2e_01"
  test_name: string         // human name e.g. "ARIA studio channel"
  severity: TestSeverity
  status: TestStatus
  score: number             // 0–100
  passed: boolean
  details: string
  error?: string
  latency_ms?: number
  deployment_url: string
  commit_sha?: string
  timestamp: string         // ISO
  run_id: string
}

export interface TestMemoryEntry {
  id?: string
  test_id: string
  test_name: string
  severity: TestSeverity
  // Rolling history
  total_runs: number
  total_passes: number
  total_fails: number
  pass_rate: number         // 0–1
  avg_score: number
  avg_latency_ms: number
  // Regression tracking
  last_status: TestStatus
  last_score: number
  last_run_at: string
  last_pass_at?: string
  last_fail_at?: string
  // Flakiness
  is_flaky: boolean
  flaky_since?: string
  consecutive_passes: number
  consecutive_fails: number
  // Known issues
  known_failure_pattern?: string
  known_fix?: string
  fix_applied_at?: string
  // Context
  last_details: string
  last_error?: string | null
  last_deployment_url: string
  created_at: string
  updated_at: string
}

export interface TestRunSummary {
  run_id: string
  deployment_url: string
  commit_sha?: string
  timestamp: string
  total_tests: number
  passed: number
  failed: number
  flaky: number
  overall_score: number
  faang_grade: string
  critical_failures: number
  regressions: string[]     // test_ids that went from pass -> fail
  improvements: string[]    // test_ids that went from fail -> pass
  new_flaky: string[]       // newly detected flaky tests
  duration_ms: number
  status: "green" | "yellow" | "red"
}

// ── IN-MEMORY LRU CACHE ───────────────────────────────────────────────────

const _cache = new Map<string, TestMemoryEntry>()
const _runCache = new Map<string, TestRunSummary>()

// ── SUPABASE OPERATIONS ───────────────────────────────────────────────────

export async function saveTestResult(result: TestResult): Promise<void> {
  try {
    const db = getSupabaseAdmin()
    await db.from("test_results_log").insert({
      test_id: result.test_id,
      test_name: result.test_name,
      severity: result.severity,
      status: result.status,
      score: result.score,
      passed: result.passed,
      details: result.details,
      error: result.error || null,
      latency_ms: result.latency_ms || 0,
      deployment_url: result.deployment_url,
      commit_sha: result.commit_sha || null,
      timestamp: result.timestamp,
      run_id: result.run_id,
    })
  } catch { /* non-blocking */ }
}

export async function upsertTestMemory(result: TestResult): Promise<TestMemoryEntry> {
  const db = getSupabaseAdmin()

  // Load existing memory for this test
  let existing: TestMemoryEntry | null = null
  try {
    const { data } = await db.from("test_memory").select("*").eq("test_id", result.test_id).single()
    existing = data as TestMemoryEntry | null
  } catch { existing = null }

  const now = new Date().toISOString()
  const prev = existing as TestMemoryEntry | null

  const total_runs = (prev?.total_runs || 0) + 1
  const total_passes = (prev?.total_passes || 0) + (result.passed ? 1 : 0)
  const total_fails = (prev?.total_fails || 0) + (result.passed ? 0 : 1)
  const pass_rate = total_passes / total_runs
  const avg_score = prev
    ? Math.round(((prev.avg_score * (total_runs - 1)) + result.score) / total_runs)
    : result.score
  const avg_latency = prev && result.latency_ms
    ? Math.round(((prev.avg_latency_ms * (total_runs - 1)) + (result.latency_ms || 0)) / total_runs)
    : result.latency_ms || 0

  const consecutive_passes = result.passed
    ? (prev?.consecutive_passes || 0) + 1
    : 0
  const consecutive_fails = !result.passed
    ? (prev?.consecutive_fails || 0) + 1
    : 0

  // Flakiness: passes sometimes, fails sometimes — oscillating pattern
  const is_flaky = total_runs >= 4 && pass_rate > 0.1 && pass_rate < 0.9 && total_fails > 0

  // Regression: was consistently passing, now failing
  const is_regression = !result.passed && (prev?.consecutive_passes || 0) >= 3

  // Known failure patterns
  let known_failure_pattern = prev?.known_failure_pattern
  let known_fix = prev?.known_fix

  if (!result.passed && result.error) {
    const err = result.error.toLowerCase()
    if (err.includes("rate") || err.includes("429") || err.includes("quota")) {
      known_failure_pattern = "Groq rate limit hit during sequential test run"
      known_fix = "Add 10-15s cooldown before this test, or switch to OpenAI fallback"
    } else if (err.includes("parse") || err.includes("json")) {
      known_failure_pattern = "JSON parse failure — API returning non-JSON response"
      known_fix = "Wrap response parsing in try/catch, check Content-Type header"
    } else if (err.includes("timeout") || err.includes("signal")) {
      known_failure_pattern = "Request timeout — agent taking too long to respond"
      known_fix = "Increase timeout to 60s, check if model is cold-starting"
    } else if (err.includes("unauthorized") || err.includes("401")) {
      known_failure_pattern = "Auth failure — wrong secret header"
      known_fix = "Check CRON_SECRET vs BRIDGE_SECRET routing for this endpoint"
    } else if (err.includes("not found") || err.includes("404")) {
      known_failure_pattern = "Route not deployed or path mismatch"
      known_fix = "Verify route file exists in app/api/, check next.config.js"
    }
  }

  const entry: Omit<TestMemoryEntry, "id"> = {
    test_id: result.test_id,
    test_name: result.test_name,
    severity: result.severity,
    total_runs,
    total_passes,
    total_fails,
    pass_rate,
    avg_score,
    avg_latency_ms: avg_latency,
    last_status: result.status,
    last_score: result.score,
    last_run_at: now,
    last_pass_at: result.passed ? now : prev?.last_pass_at,
    last_fail_at: !result.passed ? now : prev?.last_fail_at,
    is_flaky,
    flaky_since: is_flaky && !prev?.is_flaky ? now : (prev?.flaky_since ?? undefined),
    consecutive_passes,
    consecutive_fails,
    known_failure_pattern: known_failure_pattern ?? undefined,
    known_fix: known_fix ?? undefined,
    fix_applied_at: prev?.fix_applied_at ?? undefined,
    last_details: result.details,
    last_error: result.error ?? undefined,
    last_deployment_url: result.deployment_url,
    created_at: prev?.created_at || now,
    updated_at: now,
  }

  // Update cache
  _cache.set(result.test_id, entry as TestMemoryEntry)

  // Upsert to Supabase
  try {
    await db.from("test_memory").upsert(entry, { onConflict: "test_id" })
  } catch { /* non-blocking */ }

  // Log regression
  if (is_regression) {
    try {
      await db.from("test_regressions").insert({
        test_id: result.test_id,
        test_name: result.test_name,
        deployment_url: result.deployment_url,
        previous_consecutive_passes: prev?.consecutive_passes || 0,
        current_error: result.error || result.details,
        detected_at: now,
        resolved: false,
      })
    } catch { /* non-blocking */ }
  }

  return entry as TestMemoryEntry
}

export async function saveRunSummary(summary: TestRunSummary): Promise<void> {
  _runCache.set(summary.run_id, summary)
  try {
    const db = getSupabaseAdmin()
    await db.from("test_run_summaries").insert(summary)
  } catch { /* non-blocking */ }
}

export async function getTestMemory(testId: string): Promise<TestMemoryEntry | null> {
  if (_cache.has(testId)) return _cache.get(testId)!
  try {
    const db = getSupabaseAdmin()
    const res = await db.from("test_memory").select("*").eq("test_id", testId).maybeSingle()
    const data = res.data
    if (data) { _cache.set(testId, data as TestMemoryEntry); return data as TestMemoryEntry }
  } catch { /* */ }
  return null
}

export async function getAllTestMemory(): Promise<TestMemoryEntry[]> {
  try {
    const db = getSupabaseAdmin()
    const { data } = await db.from("test_memory").select("*").order("test_id")
    return (data || []) as TestMemoryEntry[]
  } catch { return [] }
}

export async function getRunHistory(limit = 20): Promise<TestRunSummary[]> {
  try {
    const db = getSupabaseAdmin()
    const { data } = await db.from("test_run_summaries").select("*").order("timestamp", { ascending: false }).limit(limit)
    return (data || []) as TestRunSummary[]
  } catch { return [] }
}

export async function getRegressions(resolved = false): Promise<Array<{ test_id: string; test_name: string; detected_at: string; current_error: string }>> {
  try {
    const db = getSupabaseAdmin()
    const { data } = await db.from("test_regressions").select("*").eq("resolved", resolved).order("detected_at", { ascending: false }).limit(20)
    return data || []
  } catch { return [] }
}

export async function getFlakyTests(): Promise<TestMemoryEntry[]> {
  try {
    const db = getSupabaseAdmin()
    const { data } = await db.from("test_memory").select("*").eq("is_flaky", true)
    return (data || []) as TestMemoryEntry[]
  } catch { return [] }
}

export async function markRegressionResolved(testId: string): Promise<void> {
  try {
    const db = getSupabaseAdmin()
    await db.from("test_regressions").update({ resolved: true, resolved_at: new Date().toISOString() }).eq("test_id", testId).eq("resolved", false)
  } catch { /* */ }
}

// ── ANALYTICS ─────────────────────────────────────────────────────────────

export interface TestHealthReport {
  total_tests_tracked: number
  healthy: number           // pass_rate >= 0.95
  flaky: number             // is_flaky = true
  degraded: number          // pass_rate 0.7–0.95
  broken: number            // pass_rate < 0.7
  critical_broken: number   // severity=critical AND pass_rate < 0.7
  avg_system_score: number
  top_failures: TestMemoryEntry[]
  known_fixes_available: number
  trend: "improving" | "stable" | "degrading"
}

export async function getTestHealthReport(): Promise<TestHealthReport> {
  const all = await getAllTestMemory()
  if (all.length === 0) return {
    total_tests_tracked: 0, healthy: 0, flaky: 0, degraded: 0, broken: 0,
    critical_broken: 0, avg_system_score: 0, top_failures: [], known_fixes_available: 0, trend: "stable"
  }

  const healthy = all.filter(t => t.pass_rate >= 0.95).length
  const flaky = all.filter(t => t.is_flaky).length
  const degraded = all.filter(t => t.pass_rate >= 0.7 && t.pass_rate < 0.95).length
  const broken = all.filter(t => t.pass_rate < 0.7).length
  const critical_broken = all.filter(t => t.severity === "critical" && t.pass_rate < 0.7).length
  const avg_system_score = Math.round(all.reduce((s, t) => s + t.avg_score, 0) / all.length)
  const top_failures = all.filter(t => !t.last_status || t.last_status === "fail")
    .sort((a, b) => (b.severity === "critical" ? 1 : 0) - (a.severity === "critical" ? 1 : 0))
    .slice(0, 5)
  const known_fixes_available = all.filter(t => t.known_fix).length

  // Trend: compare avg score of last 3 runs vs previous 3
  const runs = await getRunHistory(6)
  let trend: "improving" | "stable" | "degrading" = "stable"
  if (runs.length >= 4) {
    const recent = runs.slice(0, 3).reduce((s, r) => s + r.overall_score, 0) / 3
    const older = runs.slice(3).reduce((s, r) => s + r.overall_score, 0) / runs.slice(3).length
    if (recent > older + 3) trend = "improving"
    else if (recent < older - 3) trend = "degrading"
  }

  return { total_tests_tracked: all.length, healthy, flaky, degraded, broken, critical_broken, avg_system_score, top_failures, known_fixes_available, trend }
}
