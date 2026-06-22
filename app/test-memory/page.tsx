"use client"
export const dynamic = "force-dynamic"

import { useState, useEffect, useCallback } from "react"

interface TestMemory {
  test_id: string; test_name: string; severity: string
  total_runs: number; pass_rate: number; avg_score: number
  is_flaky: boolean; last_status: string; consecutive_fails: number
  known_failure_pattern?: string; known_fix?: string
  last_run_at: string; last_error?: string
}

interface HealthReport {
  total_tests_tracked: number; healthy: number; flaky: number
  degraded: number; broken: number; critical_broken: number
  avg_system_score: number; known_fixes_available: number
  trend: string; top_failures: TestMemory[]
}

interface RunSummary {
  run_id: string; timestamp: string; overall_score: number
  faang_grade: string; passed: number; failed: number
  critical_failures: number; status: string; deployment_url: string
}

const SEV_COLOR: Record<string, string> = { critical: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#22c55e" }
const STATUS_BG: Record<string, string> = { pass: "#0d1a0d", fail: "#1a0d0d", flaky: "#1a1400", error: "#1a0d0d" }
const STATUS_FG: Record<string, string> = { pass: "#22c55e", fail: "#ef4444", flaky: "#f59e0b", error: "#ef4444" }
const TREND_ICON: Record<string, string> = { improving: "↑", stable: "→", degrading: "↓" }
const TREND_COLOR: Record<string, string> = { improving: "#22c55e", stable: "#888", degrading: "#ef4444" }

export default function TestMemoryPage() {
  const [health, setHealth] = useState<HealthReport | null>(null)
  const [tests, setTests] = useState<TestMemory[]>([])
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [tab, setTab] = useState<"overview"|"tests"|"history"|"flaky">("overview")
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const [h, t, r] = await Promise.all([
      fetch("/api/test-memory?view=health").then(r => r.json()).catch(() => null),
      fetch("/api/test-memory?view=all").then(r => r.json()).catch(() => ({ tests: [] })),
      fetch("/api/test-memory?view=history&limit=15").then(r => r.json()).catch(() => ({ runs: [] })),
    ])
    setHealth(h)
    setTests((t.tests || []) as TestMemory[])
    setRuns((r.runs || []) as RunSummary[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = tests.filter(t =>
    !filter || t.test_name.toLowerCase().includes(filter.toLowerCase()) ||
    t.test_id.toLowerCase().includes(filter.toLowerCase())
  )

  const CELL: React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid #111", fontSize: 12 }

  if (loading) return <div style={{ background: "#000", height: "100vh", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui" }}>Loading test memory...</div>

  return (
    <div style={{ background: "#000", minHeight: "100vh", color: "#fff", fontFamily: "system-ui,-apple-system,sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Test Memory</h1>
            <p style={{ margin: "4px 0 0", color: "#333", fontSize: 12 }}>Persistent pass/fail history · flaky detection · regression tracking</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {health && (
              <span style={{ color: TREND_COLOR[health.trend], fontSize: 13, fontWeight: 700 }}>
                {TREND_ICON[health.trend]} {health.trend}
              </span>
            )}
            <button onClick={load} style={{ background: "#111", border: "1px solid #222", color: "#888", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 11 }}>↻ Refresh</button>
          </div>
        </div>

        {/* Health cards */}
        {health && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 24 }}>
            {[
              { label: "Healthy", value: health.healthy, color: "#22c55e" },
              { label: "Flaky", value: health.flaky, color: "#f59e0b" },
              { label: "Degraded", value: health.degraded, color: "#f97316" },
              { label: "Broken", value: health.broken, color: "#ef4444" },
              { label: "Total Tracked", value: health.total_tests_tracked, color: "#fff" },
              { label: "Avg Score", value: health.avg_system_score + "%", color: health.avg_system_score >= 95 ? "#22c55e" : health.avg_system_score >= 75 ? "#f59e0b" : "#ef4444" },
              { label: "Critical Broken", value: health.critical_broken, color: health.critical_broken === 0 ? "#22c55e" : "#ef4444" },
              { label: "Known Fixes", value: health.known_fixes_available, color: "#3b82f6" },
            ].map(c => (
              <div key={c.label} style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ color: c.color, fontSize: 20, fontWeight: 900 }}>{c.value}</div>
                <div style={{ color: "#444", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>{c.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {(["overview","tests","history","flaky"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: tab === t ? "#fff" : "#0a0a0a",
              color: tab === t ? "#000" : "#555",
              border: "1px solid " + (tab === t ? "transparent" : "#1a1a1a"),
              borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 11, fontWeight: 600, textTransform: "capitalize",
            }}>{t}</button>
          ))}
        </div>

        {/* Overview — top failures + known fixes */}
        {tab === "overview" && health && (
          <div>
            {health.top_failures.length > 0 ? (
              <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "12px 14px", borderBottom: "1px solid #1a1a1a", color: "#ef4444", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Top Failures</div>
                {health.top_failures.map((t, i) => (
                  <div key={t.test_id} style={{ ...CELL, borderBottom: i < health.top_failures.length - 1 ? "1px solid #111" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ color: "#ddd", fontWeight: 600 }}>{t.test_name}</span>
                      <span style={{ color: SEV_COLOR[t.severity], fontSize: 10 }}>{t.severity.toUpperCase()}</span>
                    </div>
                    {t.known_failure_pattern && <div style={{ color: "#666", fontSize: 11, marginBottom: 2 }}>Pattern: {t.known_failure_pattern}</div>}
                    {t.known_fix && <div style={{ color: "#22c55e", fontSize: 11 }}>Fix: {t.known_fix}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 40, color: "#333", fontSize: 13 }}>No failures in memory yet — run the validator to start tracking</div>
            )}
          </div>
        )}

        {/* All tests */}
        {tab === "tests" && (
          <div>
            <input
              placeholder="Filter tests..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{ width: "100%", background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 12, outline: "none", marginBottom: 12, boxSizing: "border-box" }}
            />
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#333", fontSize: 13 }}>No tests tracked yet</div>
            ) : (
              <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 70px 70px 70px 80px 1fr", padding: "8px 14px", borderBottom: "1px solid #111", color: "#333", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                  <span>Test</span><span>Status</span><span>Pass %</span><span>Score</span><span>Runs</span><span>Known Fix</span>
                </div>
                {filtered.map((t, i) => (
                  <div key={t.test_id} style={{ display: "grid", gridTemplateColumns: "2fr 70px 70px 70px 80px 1fr", ...CELL, background: STATUS_BG[t.last_status] || "transparent", borderBottom: i < filtered.length - 1 ? "1px solid #111" : "none" }}>
                    <div>
                      <span style={{ color: "#ddd" }}>{t.test_name}</span>
                      <span style={{ color: SEV_COLOR[t.severity], fontSize: 9, marginLeft: 6 }}>{t.severity.toUpperCase()}</span>
                      {t.is_flaky && <span style={{ color: "#f59e0b", fontSize: 9, marginLeft: 6 }}>FLAKY</span>}
                    </div>
                    <span style={{ color: STATUS_FG[t.last_status] || "#888", fontWeight: 700 }}>{(t.last_status || "—").toUpperCase()}</span>
                    <span style={{ color: t.pass_rate >= 0.95 ? "#22c55e" : t.pass_rate >= 0.7 ? "#f59e0b" : "#ef4444" }}>{Math.round((t.pass_rate || 0) * 100)}%</span>
                    <span style={{ color: "#ddd" }}>{t.avg_score || 0}</span>
                    <span style={{ color: "#555" }}>{t.total_runs || 0}</span>
                    <span style={{ color: "#22c55e", fontSize: 10 }}>{t.known_fix ? t.known_fix.slice(0, 50) + "..." : "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Run history */}
        {tab === "history" && (
          <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 12, overflow: "hidden" }}>
            {runs.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#333", fontSize: 13 }}>No run history yet</div>
            ) : runs.map((r, i) => (
              <div key={r.run_id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 80px 80px", padding: "10px 14px", borderBottom: i < runs.length - 1 ? "1px solid #111" : "none", fontSize: 12 }}>
                <div>
                  <div style={{ color: "#ddd" }}>{new Date(r.timestamp).toLocaleString()}</div>
                  <div style={{ color: "#333", fontSize: 10, marginTop: 2 }}>{r.run_id.slice(0, 30)}</div>
                </div>
                <span style={{ color: r.overall_score >= 95 ? "#22c55e" : r.overall_score >= 75 ? "#f59e0b" : "#ef4444", fontWeight: 700 }}>{r.overall_score}%</span>
                <span style={{ color: r.faang_grade === "A+" || r.faang_grade === "A" ? "#22c55e" : "#f59e0b" }}>{r.faang_grade || "?"}</span>
                <span style={{ color: "#555" }}>{r.passed}/{(r.passed + r.failed) || 0}</span>
                <span style={{ color: r.critical_failures > 0 ? "#ef4444" : "#22c55e", fontSize: 10 }}>{r.critical_failures} crit</span>
              </div>
            ))}
          </div>
        )}

        {/* Flaky tests */}
        {tab === "flaky" && (
          <div>
            {tests.filter(t => t.is_flaky).length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#333", fontSize: 13 }}>No flaky tests detected yet</div>
            ) : tests.filter(t => t.is_flaky).map((t, i) => (
              <div key={t.test_id} style={{ background: "#0a0a0a", border: "1px solid #1a1300", borderRadius: 10, padding: 16, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#f59e0b", fontWeight: 700 }}>{t.test_name}</span>
                  <span style={{ color: "#555", fontSize: 10 }}>Pass rate: {Math.round(t.pass_rate * 100)}%</span>
                </div>
                {t.known_failure_pattern && <div style={{ color: "#666", fontSize: 11, marginTop: 6 }}>Pattern: {t.known_failure_pattern}</div>}
                {t.known_fix && <div style={{ color: "#22c55e", fontSize: 11, marginTop: 4 }}>Suggested fix: {t.known_fix}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 32 }}>
          {["/","/studio","/workflows","/capabilities"].map(l => (
            <a key={l} href={l} style={{ color: "#333", fontSize: 11, textDecoration: "none" }}>{l}</a>
          ))}
        </div>
      </div>
    </div>
  )
}
