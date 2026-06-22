"use client"
export const dynamic = "force-dynamic"

import { useState, useEffect } from "react"

interface Capability {
  id: number; name: string; category: string; benchmark: string
  targetScore: number; currentScore: number; status: string
  description: string; autoInstalled: boolean
}

const CAT_COLORS: Record<string, string> = {
  reasoning: "#6366f1", coding: "#22c55e", browser: "#3b82f6",
  memory: "#f59e0b", planning: "#ec4899", multimodal: "#8b5cf6",
  tools: "#14b8a6", communication: "#f97316", self_improvement: "#ef4444",
  orchestration: "#06b6d4",
}

export default function CapabilitiesPage() {
  const [caps, setCaps] = useState<Capability[]>([])
  const [stats, setStats] = useState<{ total: number; active: number; avgCurrent: number; avgTarget: number; gpa: string } | null>(null)
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [benchResult, setBenchResult] = useState<string>("")

  useEffect(() => {
    fetch("/api/benchmark").then(r => r.json()).then(d => {
      setCaps(d.capabilities || [])
      setStats(d.stats || null)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const runBenchmark = async () => {
    setRunning(true)
    setBenchResult("")
    try {
      const r = await fetch("/api/install")
      const d = await r.json()
      setBenchResult(`✓ ${d.installed}/${d.total} capabilities installed (${d.percentage}%)`)
    } catch { setBenchResult("Run failed") }
    setRunning(false)
  }

  const cats = ["all", ...Array.from(new Set(caps.map(c => c.category)))]
  const filtered = filter === "all" ? caps : caps.filter(c => c.category === filter)

  if (loading) return <div style={{ background: "#000", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "system-ui" }}>Loading capabilities...</div>

  return (
    <div style={{ background: "#000", minHeight: "100vh", color: "#fff", fontFamily: "system-ui,-apple-system,sans-serif", padding: 32 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#fff" }}>Agent Zero — 30 Capabilities</h1>
              <p style={{ margin: "6px 0 0", color: "#444", fontSize: 13 }}>Based on GAIA, SWE-bench, WebArena, OSWorld, BrowseComp, τ-bench</p>
            </div>
            <button onClick={runBenchmark} disabled={running} style={{ background: running ? "#111" : "#fff", color: running ? "#444" : "#000", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: running ? "not-allowed" : "pointer", fontSize: 13 }}>
              {running ? "Running..." : "▶ Run Installer"}
            </button>
          </div>
          {benchResult && <div style={{ background: "#0d1a0d", border: "1px solid #22c55e30", borderRadius: 8, padding: "10px 16px", color: "#22c55e", fontSize: 13 }}>{benchResult}</div>}
        </div>

        {/* Stats */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 32 }}>
            {[
              { label: "Total Capabilities", value: stats.total, color: "#fff" },
              { label: "Active", value: stats.active, color: "#22c55e" },
              { label: "Avg Score", value: stats.avgCurrent + "%", color: "#3b82f6" },
              { label: "Avg Target", value: stats.avgTarget + "%", color: "#f59e0b" },
              { label: "GPA", value: stats.gpa + " / 4.0", color: "#6366f1" },
            ].map(s => (
              <div key={s.label} style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ color: "#444", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{s.label}</div>
                <div style={{ color: s.color, fontSize: 22, fontWeight: 800 }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
          {cats.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)} style={{
              background: filter === cat ? (CAT_COLORS[cat] || "#fff") : "#0a0a0a",
              color: filter === cat ? "#fff" : "#555",
              border: `1px solid ${filter === cat ? "transparent" : "#1a1a1a"}`,
              borderRadius: 20, padding: "5px 14px", cursor: "pointer", fontSize: 11, fontWeight: 600,
              textTransform: "capitalize",
            }}>
              {cat}
            </button>
          ))}
        </div>

        {/* Capability Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
          {filtered.map(cap => {
            const pct = Math.round((cap.currentScore / cap.targetScore) * 100)
            const color = CAT_COLORS[cap.category] || "#fff"
            const statusColor = cap.status === "active" ? "#22c55e" : cap.status === "partial" ? "#f59e0b" : cap.status === "pending" ? "#555" : "#ef4444"
            return (
              <div key={cap.id} style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ background: color + "20", color, fontSize: 10, padding: "2px 8px", borderRadius: 12, fontWeight: 700, textTransform: "uppercase" }}>{cap.category}</span>
                    <span style={{ color: "#333", fontSize: 11 }}>#{cap.id}</span>
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, display: "inline-block" }} />
                    <span style={{ color: statusColor, fontSize: 10, fontWeight: 600 }}>{cap.status}</span>
                    {cap.autoInstalled && <span style={{ color: "#22c55e", fontSize: 9, marginLeft: 4 }}>AUTO</span>}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#e0e0e0", marginBottom: 4 }}>{cap.name}</div>
                <div style={{ color: "#444", fontSize: 11, lineHeight: 1.5, marginBottom: 10 }}>{cap.description}</div>
                <div style={{ color: "#333", fontSize: 10, marginBottom: 8 }}>📊 {cap.benchmark}</div>
                {/* Progress bar */}
                <div style={{ background: "#111", borderRadius: 4, height: 4, overflow: "hidden" }}>
                  <div style={{ background: color, width: pct + "%", height: "100%", borderRadius: 4, transition: "width 0.3s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                  <span style={{ color: "#444", fontSize: 10 }}>{cap.currentScore}% current</span>
                  <span style={{ color: "#333", fontSize: 10 }}>{cap.targetScore}% target</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
