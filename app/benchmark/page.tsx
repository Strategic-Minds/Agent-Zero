/**
 * /benchmark — Live Benchmark Dashboard
 * Shows real-time test scores, history, improvement targets
 */
"use client"
import { useState, useEffect } from "react"

interface TestResult {
  id: string; category: string; name: string; status: string
  score: number; latency_ms: number; detail: string; weight: number
}

interface BenchmarkReport {
  run_id: string; timestamp: string; overall_score: number; tier: string
  category_scores: Record<string, number>; dimension_scores: Record<string, number>
  tests: TestResult[]; passed: number; failed: number; total: number
  deployable: boolean; improvement_targets: string[]; model: string; version: string
}

const TIER_COLOR: Record<string, string> = {
  "S-TIER 🏆": "#00d4a0", "A-TIER ✅": "#00c853", "B-TIER ⚡": "#ffd600",
  "C-TIER ⚠️": "#ff6d00", "F-TIER ❌": "#d50000",
}

const CAT_ICONS: Record<string, string> = {
  INFRASTRUCTURE: "🏗️", TOOL_ACCURACY: "🔧", GOVERNANCE: "🛡️",
  MEMORY: "🧠", BUSINESS_INTEL: "📊", RESPONSE_QUALITY: "💬",
}

export default function BenchmarkPage() {
  const [report, setReport] = useState<BenchmarkReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [elapsed, setElapsed] = useState(0)
  const [timer, setTimer] = useState<ReturnType<typeof setInterval> | null>(null)

  const runBenchmark = async () => {
    setLoading(true); setError(""); setReport(null); setElapsed(0)
    const t0 = Date.now()
    const iv = setInterval(() => setElapsed(Math.floor((Date.now()-t0)/1000)), 1000)
    setTimer(iv)
    try {
      const res = await fetch("/api/benchmark", { signal: AbortSignal.timeout(280000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as BenchmarkReport
      setReport(data)
    } catch (e) { setError(String(e)) }
    finally { setLoading(false); clearInterval(iv) }
  }

  useEffect(() => { return () => { if (timer) clearInterval(timer) } }, [timer])

  const scoreColor = (s: number) => s >= 95 ? "#00d4a0" : s >= 85 ? "#00c853" : s >= 70 ? "#ffd600" : s >= 50 ? "#ff6d00" : "#d50000"

  return (
    <div style={{ background: "#0a0a14", minHeight: "100vh", color: "#e0e0e0", fontFamily: "'JetBrains Mono', monospace", padding: "24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{ color: "#00d4a0", fontSize: 28, fontWeight: 700, margin: 0 }}>AGENT ZERO — BENCHMARK LAB</h1>
            <p style={{ color: "#666", fontSize: 13, margin: "6px 0 0" }}>
              Enterprise test suite • GAIA + AgentBench + SWE-bench + MLflow GPA model • 40 tests
            </p>
          </div>
          <button onClick={runBenchmark} disabled={loading} style={{
            background: loading ? "#1a1a2e" : "#00d4a0", color: loading ? "#666" : "#0a0a14",
            border: "none", padding: "12px 28px", borderRadius: 8, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer", fontSize: 15, fontFamily: "inherit",
          }}>
            {loading ? `RUNNING... ${elapsed}s` : "▶ RUN BENCHMARK"}
          </button>
        </div>

        {error && (
          <div style={{ background: "#2a0a0a", border: "1px solid #d50000", borderRadius: 8, padding: 16, marginBottom: 24, color: "#ff6b6b" }}>
            ❌ Error: {error}
          </div>
        )}

        {loading && (
          <div style={{ background: "#0d1117", border: "1px solid #00d4a030", borderRadius: 12, padding: 32, textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
            <p style={{ color: "#00d4a0", fontSize: 16, fontWeight: 700 }}>Running {40} enterprise tests...</p>
            <p style={{ color: "#666", fontSize: 13 }}>GAIA + AgentBench + SWE-bench methodology • {elapsed}s elapsed</p>
            <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {["Infrastructure","Tool Accuracy","Governance","Memory","Business Intel","Response Quality"].map(c => (
                <span key={c} style={{ background: "#1a1a2e", padding: "4px 10px", borderRadius: 20, fontSize: 11, color: "#888" }}>{c}</span>
              ))}
            </div>
          </div>
        )}

        {report && (
          <>
            {/* Score Card */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
              {[
                { label: "OVERALL SCORE", value: `${report.overall_score}%`, color: scoreColor(report.overall_score), big: true },
                { label: "TIER", value: report.tier, color: TIER_COLOR[report.tier] || "#888" },
                { label: "TESTS PASSED", value: `${report.passed}/${report.total}`, color: "#00c853" },
                { label: "DEPLOYABLE", value: report.deployable ? "YES ✅" : "NO ⚠️", color: report.deployable ? "#00c853" : "#ff6d00" },
              ].map(card => (
                <div key={card.label} style={{ background: "#0d1117", border: `1px solid ${card.color}30`, borderRadius: 12, padding: "20px 24px" }}>
                  <p style={{ color: "#555", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>{card.label}</p>
                  <p style={{ color: card.color, fontSize: card.big ? 42 : 24, fontWeight: 800, margin: 0 }}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* Category Scores */}
            <div style={{ background: "#0d1117", border: "1px solid #1e2a3a", borderRadius: 12, padding: 24, marginBottom: 20 }}>
              <h3 style={{ color: "#00d4a0", fontSize: 14, margin: "0 0 20px", textTransform: "uppercase", letterSpacing: 1 }}>CATEGORY SCORES</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {Object.entries(report.category_scores).map(([cat, score]) => (
                  <div key={cat}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: "#aaa" }}>{CAT_ICONS[cat] || "📋"} {cat.replace(/_/g," ")}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(score) }}>{score}%</span>
                    </div>
                    <div style={{ background: "#1a1a2e", borderRadius: 4, height: 6 }}>
                      <div style={{ background: scoreColor(score), height: 6, borderRadius: 4, width: `${score}%`, transition: "width 1s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dimension Scores (MLflow GPA) */}
            <div style={{ background: "#0d1117", border: "1px solid #1e2a3a", borderRadius: 12, padding: 24, marginBottom: 20 }}>
              <h3 style={{ color: "#00d4a0", fontSize: 14, margin: "0 0 20px", textTransform: "uppercase", letterSpacing: 1 }}>MLflow AGENT GPA DIMENSIONS</h3>
              {Object.entries(report.dimension_scores).map(([dim, score]) => (
                <div key={dim} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: "#888", minWidth: 200 }}>{dim}</span>
                  <div style={{ flex: 1, background: "#1a1a2e", borderRadius: 4, height: 8 }}>
                    <div style={{ background: scoreColor(score as number), height: 8, borderRadius: 4, width: `${score}%` }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(score as number), minWidth: 40, textAlign: "right" }}>{score}%</span>
                </div>
              ))}
            </div>

            {/* Test Results */}
            <div style={{ background: "#0d1117", border: "1px solid #1e2a3a", borderRadius: 12, padding: 24, marginBottom: 20 }}>
              <h3 style={{ color: "#00d4a0", fontSize: 14, margin: "0 0 20px", textTransform: "uppercase", letterSpacing: 1 }}>
                TEST RESULTS — {report.passed}/{report.total} PASSED
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1e2a3a" }}>
                      {["ID","Category","Test Name","Status","Score","Latency","Detail"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#555", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.tests.map(t => (
                      <tr key={t.id} style={{ borderBottom: "1px solid #0d1117", background: t.status==="FAIL" ? "#1a0a0a" : "transparent" }}>
                        <td style={{ padding: "8px 12px", color: "#666", fontFamily: "monospace" }}>{t.id}</td>
                        <td style={{ padding: "8px 12px", color: "#888", fontSize: 11 }}>{t.category.replace(/_/g," ")}</td>
                        <td style={{ padding: "8px 12px", color: "#ccc" }}>{t.name}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ color: t.status==="PASS"?"#00c853":t.status==="FAIL"?"#d50000":"#ffd600", fontWeight: 700, fontSize: 11 }}>
                            {t.status==="PASS"?"✅":t.status==="FAIL"?"❌":"⚡"} {t.status}
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px", color: scoreColor(t.score), fontWeight: 700 }}>{t.score}%</td>
                        <td style={{ padding: "8px 12px", color: t.latency_ms>30000?"#ff6d00":"#666", fontFamily: "monospace", fontSize: 11 }}>{t.latency_ms>0?`${(t.latency_ms/1000).toFixed(1)}s`:"—"}</td>
                        <td style={{ padding: "8px 12px", color: "#555", fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Improvement Targets */}
            {report.improvement_targets.length > 0 && (
              <div style={{ background: "#1a0a0a", border: "1px solid #d5000030", borderRadius: 12, padding: 24 }}>
                <h3 style={{ color: "#ff6b6b", fontSize: 14, margin: "0 0 16px", textTransform: "uppercase", letterSpacing: 1 }}>🎯 IMPROVEMENT TARGETS (APEX auto-fix queue)</h3>
                {report.improvement_targets.map((t, i) => (
                  <div key={i} style={{ background: "#0d1117", borderRadius: 6, padding: "10px 14px", marginBottom: 8, fontSize: 12, color: "#aaa", fontFamily: "monospace" }}>
                    {i+1}. {t}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 16, textAlign: "right", color: "#444", fontSize: 11 }}>
              Run ID: {report.run_id} • Model: {report.model} • {new Date(report.timestamp).toLocaleString()}
            </div>
          </>
        )}

        {!report && !loading && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#444" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🤖</div>
            <p style={{ fontSize: 18, color: "#666" }}>Click <b style={{color:"#00d4a0"}}>RUN BENCHMARK</b> to evaluate Agent Zero</p>
            <p style={{ fontSize: 13, color: "#444" }}>40 tests • GAIA + AgentBench + SWE-bench + MLflow GPA • Target: 95%+ (S-Tier)</p>
          </div>
        )}
      </div>
    </div>
  )
}
