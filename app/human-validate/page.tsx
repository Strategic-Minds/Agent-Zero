"use client"
export const dynamic = "force-dynamic"

import { useState, useEffect, useCallback } from "react"
import type { ValidationReport, TestRun } from "@/lib/headless-validator"

const PRI_COLOR: Record<string, string> = { P0: "#ef4444", P1: "#f97316", P2: "#f59e0b", P3: "#22c55e" }
const CAT_ICON: Record<string, string> = { page_load: "🌐", navigation: "🔗", chat_forms: "💬", api_calls: "⚡", buttons: "🖱️", user_flows: "🚶", search: "🔍", auth_flows: "🔐", error_states: "⚠️", performance: "📊", mobile_ux: "📱", accessibility: "♿", data_flows: "🗄️", realtime: "🔴", self_heal: "🔧" }
const GRADE_COLOR: Record<string, string> = { "A+": "#22c55e", A: "#4ade80", "B+": "#f59e0b", B: "#f97316", C: "#ef4444", F: "#7f1d1d" }

export default function HumanValidatePage() {
  const [report, setReport] = useState<ValidationReport | null>(null)
  const [suite, setSuite] = useState<{ total: number; tests: Array<{ id: string; name: string; category: string; priority: string; severity: string }> } | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<"overview" | "results" | "categories" | "suite">("overview")
  const [filter, setFilter] = useState<string>("")

  const loadSuite = useCallback(async () => {
    const d = await fetch("/api/human-validate?suite=list").then(r => r.json())
    setSuite(d)
  }, [])

  useEffect(() => { loadSuite() }, [loadSuite])

  const runValidation = async (priorities?: string[]) => {
    setLoading(true)
    setReport(null)
    try {
      const body: Record<string, unknown> = {}
      if (priorities) body.priorities = priorities
      const r = await fetch("/api/human-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-human-validate": "true" },
        body: JSON.stringify(body),
      })
      const d = await r.json() as ValidationReport
      setReport(d)
      setTab("results")
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const filteredRuns = (report?.test_runs || []).filter(r =>
    !filter || r.name.toLowerCase().includes(filter.toLowerCase()) || r.category.includes(filter) || r.priority === filter
  )

  return (
    <div style={{ background: "#000", minHeight: "100vh", color: "#fff", fontFamily: "system-ui,-apple-system,sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ color: "#333", fontSize: 10, textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>Agent Zero · Enterprise Validation</div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Headless Human-Agent Validator</h1>
            <p style={{ margin: "6px 0 0", color: "#444", fontSize: 12 }}>
              Simulates a real user — clicks, types, navigates, submits forms, tests every UI component
            </p>
          </div>
          {report && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 48, fontWeight: 900, color: GRADE_COLOR[report.faang_grade] || "#fff" }}>{report.faang_grade}</div>
              <div style={{ fontSize: 13, color: GRADE_COLOR[report.faang_grade] }}>{report.overall_score}%</div>
              <div style={{ fontSize: 10, color: report.url_cleared ? "#22c55e" : "#ef4444", fontWeight: 700, marginTop: 4 }}>
                {report.url_cleared ? "✅ URL CLEARED" : "🚫 BLOCKED"}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          <button onClick={() => runValidation()} disabled={loading} style={{ background: loading ? "#111" : "#fff", color: loading ? "#333" : "#000", border: "none", borderRadius: 8, padding: "10px 20px", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 12 }}>
            {loading ? "🔄 Running Human Agent..." : "▶ Run Full Validation (All Tests)"}
          </button>
          <button onClick={() => runValidation(["P0"])} disabled={loading} style={{ background: "#0a0a0a", color: "#ef4444", border: "1px solid #1a1a1a", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>P0 Critical Only</button>
          <button onClick={() => runValidation(["P0","P1"])} disabled={loading} style={{ background: "#0a0a0a", color: "#f97316", border: "1px solid #1a1a1a", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>P0 + P1</button>
          <a href="/test-memory" style={{ background: "#0a0a0a", color: "#888", border: "1px solid #1a1a1a", borderRadius: 8, padding: "10px 16px", textDecoration: "none", fontSize: 12 }}>📊 Test Memory</a>
          <a href="/" style={{ background: "#0a0a0a", color: "#888", border: "1px solid #1a1a1a", borderRadius: 8, padding: "10px 16px", textDecoration: "none", fontSize: 12 }}>← Home</a>
        </div>

        {/* Suite info */}
        {suite && !report && (
          <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <div style={{ color: "#333", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Test Suite — {suite.total} tests ready</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {(suite.tests.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + 1; return acc }, {} as Record<string, number>)) &&
                [...new Set(suite.tests.map(t => t.category))].map(cat => (
                  <div key={cat} style={{ fontSize: 11, color: "#555" }}>
                    {CAT_ICON[cat] || "🔹"} {cat.replace(/_/g, " ")} ({suite.tests.filter(t => t.category === cat).length})
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {report && (
          <div>
            {/* Score cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 20 }}>
              {[{ l: "Total", v: report.total_tests, c: "#fff" }, { l: "Passed", v: report.passed, c: "#22c55e" }, { l: "Failed", v: report.failed, c: report.failed > 0 ? "#ef4444" : "#22c55e" }, { l: "P0 Fail", v: report.p0_failures, c: report.p0_failures > 0 ? "#ef4444" : "#22c55e" }, { l: "P1 Fail", v: report.p1_failures, c: report.p1_failures > 0 ? "#f97316" : "#22c55e" }].map(c => (
                <div key={c.l} style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ color: c.c, fontSize: 24, fontWeight: 900 }}>{c.v}</div>
                  <div style={{ color: "#444", fontSize: 10, textTransform: "uppercase" }}>{c.l}</div>
                </div>
              ))}
            </div>

            {/* Recommendation */}
            <div style={{ background: report.url_cleared ? "#0d1a0d" : "#1a0d0d", border: "1px solid " + (report.url_cleared ? "#15803d" : "#991b1b"), borderRadius: 10, padding: 16, marginBottom: 20, fontSize: 13 }}>
              {report.recommendation}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
              {(["overview","results","categories","suite"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ background: tab===t?"#fff":"#0a0a0a", color: tab===t?"#000":"#555", border: "1px solid "+(tab===t?"transparent":"#1a1a1a"), borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 11, fontWeight: 600, textTransform: "capitalize" }}>{t}</button>
              ))}
            </div>

            {/* Overview: blocking failures */}
            {tab === "overview" && (
              <div>
                {report.blocking_failures.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#22c55e", fontSize: 14 }}>✅ No blocking failures — system CLEARED</div>
                ) : (
                  <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid #111", color: "#ef4444", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                      {report.blocking_failures.length} Blocking Failures
                    </div>
                    {report.blocking_failures.map((t, i) => (
                      <div key={t.id} style={{ padding: "12px 16px", borderBottom: i < report.blocking_failures.length-1 ? "1px solid #111" : "none" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ color: PRI_COLOR[t.priority], fontWeight: 700, fontSize: 11 }}>[{t.priority}]</span>
                          <span style={{ color: "#ddd", fontSize: 12 }}>{t.name}</span>
                          <span style={{ color: "#ef4444", fontSize: 11 }}>{t.score}% · {t.latency_ms}ms</span>
                        </div>
                        {t.failure_reason && <div style={{ color: "#666", fontSize: 11 }}>{t.failure_reason.slice(0, 120)}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Results: all test runs */}
            {tab === "results" && (
              <div>
                <input placeholder="Filter by name, category, or P0/P1/P2/P3..." value={filter} onChange={e => setFilter(e.target.value)}
                  style={{ width: "100%", background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 12, outline: "none", marginBottom: 12, boxSizing: "border-box" }}
                />
                <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 80px 60px 70px 80px", padding: "8px 14px", borderBottom: "1px solid #111", color: "#333", fontSize: 10, textTransform: "uppercase" }}>
                    <span>Pri</span><span>Test</span><span>Status</span><span>Score</span><span>Latency</span><span>Actions</span>
                  </div>
                  {filteredRuns.map((r, i) => (
                    <div key={r.id} style={{ display: "grid", gridTemplateColumns: "60px 1fr 80px 60px 70px 80px", padding: "10px 14px", fontSize: 12, borderBottom: i < filteredRuns.length-1 ? "1px solid #0a0a0a" : "none", background: r.passed ? "transparent" : "#100808" }}>
                      <span style={{ color: PRI_COLOR[r.priority], fontWeight: 700 }}>{r.priority}</span>
                      <div>
                        <div style={{ color: "#ddd" }}>{CAT_ICON[r.category]} {r.name}</div>
                        {!r.passed && r.failure_reason && <div style={{ color: "#555", fontSize: 10, marginTop: 2 }}>{r.failure_reason.slice(0, 80)}</div>}
                      </div>
                      <span style={{ color: r.passed ? "#22c55e" : "#ef4444", fontWeight: 700 }}>{r.status.toUpperCase()}</span>
                      <span style={{ color: r.score >= 95 ? "#22c55e" : r.score >= 75 ? "#f59e0b" : "#ef4444" }}>{r.score}%</span>
                      <span style={{ color: "#555" }}>{r.latency_ms}ms</span>
                      <span style={{ color: "#444" }}>{r.actions_executed}/{r.assertions_total}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Categories */}
            {tab === "categories" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                {Object.entries(report.category_scores).map(([cat, score]) => (
                  <div key={cat} style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{CAT_ICON[cat] || "🔹"}</div>
                    <div style={{ color: "#ddd", fontSize: 12, marginBottom: 6 }}>{cat.replace(/_/g," ")}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: score>=95?"#22c55e":score>=75?"#f59e0b":"#ef4444" }}>{score}%</div>
                    <div style={{ height: 4, background: "#111", borderRadius: 2, marginTop: 8 }}>
                      <div style={{ height: "100%", width: score+"%", background: score>=95?"#22c55e":score>=75?"#f59e0b":"#ef4444", borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Suite */}
            {tab === "suite" && suite && (
              <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 12, overflow: "hidden" }}>
                {suite.tests.map((t, i) => (
                  <div key={t.id} style={{ display: "grid", gridTemplateColumns: "80px 1fr 100px 80px", padding: "8px 14px", borderBottom: i < suite.tests.length-1 ? "1px solid #0a0a0a" : "none", fontSize: 11 }}>
                    <span style={{ color: "#333" }}>{t.id}</span>
                    <span style={{ color: "#888" }}>{CAT_ICON[t.category]} {t.name}</span>
                    <span style={{ color: PRI_COLOR[t.priority] }}>{t.priority}</span>
                    <span style={{ color: "#444" }}>{t.severity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 32 }}>
          {["/","/studio","/workflows","/capabilities","/test-memory"].map(l => <a key={l} href={l} style={{ color: "#333", fontSize: 11, textDecoration: "none" }}>{l}</a>)}
        </div>
      </div>
    </div>
  )
}
