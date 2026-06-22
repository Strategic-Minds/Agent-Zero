"use client"
export const dynamic = "force-dynamic"

import { useState } from "react"

interface AgentResult { agent: string; success: boolean; latency_ms: number }

export default function Home() {
  const [task, setTask] = useState("")
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [result, setResult] = useState<{ synthesized_response?: string; agents_used?: AgentResult[]; status?: string; total_latency_ms?: number } | null>(null)
  const [loading, setLoading] = useState(false)

  const AGENTS = ["aria","discovery","intelligence","outreach","ghost","apex","validator","benchmark"]

  const runOrchestration = async () => {
    if (!task.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const r = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-chatgpt-action": "true" },
        body: JSON.stringify({ task, agents: selectedAgents.length > 0 ? selectedAgents : undefined }),
      })
      const d = await r.json() as typeof result
      setResult(d)
    } catch (e) { setResult({ synthesized_response: "Error: " + String(e) }) }
    setLoading(false)
  }

  const toggleAgent = (a: string) => setSelectedAgents(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a])

  return (
    <div style={{ background: "#000", minHeight: "100vh", color: "#fff", fontFamily: "system-ui,-apple-system,sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 720 }}>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: "#333", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Strategic Minds Advisory</div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, background: "linear-gradient(135deg,#fff,#888)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Agent Zero</h1>
          <p style={{ margin: "8px 0 0", color: "#444", fontSize: 13 }}>Parallel Multi-Agent Orchestrator · 8 Active Sub-Agents</p>
        </div>

        {/* Agent selector */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: "#333", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Target Agents (all = auto-route)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {AGENTS.map(a => (
              <button key={a} onClick={() => toggleAgent(a)} style={{
                background: selectedAgents.includes(a) ? "#fff" : "#0a0a0a",
                color: selectedAgents.includes(a) ? "#000" : "#555",
                border: "1px solid " + (selectedAgents.includes(a) ? "transparent" : "#1a1a1a"),
                borderRadius: 20, padding: "5px 14px", cursor: "pointer", fontSize: 11, fontWeight: 600, textTransform: "capitalize",
              }}>{a}</button>
            ))}
          </div>
        </div>

        {/* Task input */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <textarea
            value={task}
            onChange={e => setTask(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runOrchestration() } }}
            placeholder="What should the agent swarm work on? e.g. Find and score 20 epoxy leads in Scottsdale AZ"
            style={{ width: "100%", background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 12, padding: "14px 50px 14px 16px", color: "#fff", fontSize: 13, resize: "none", outline: "none", minHeight: 72, boxSizing: "border-box", lineHeight: 1.5 }}
          />
          <button onClick={runOrchestration} disabled={loading || !task.trim()} style={{
            position: "absolute", right: 10, bottom: 10,
            background: loading || !task.trim() ? "#111" : "#fff", color: loading || !task.trim() ? "#333" : "#000",
            border: "none", borderRadius: 8, padding: "6px 14px", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 12,
          }}>
            {loading ? "..." : "↑"}
          </button>
        </div>

        {/* Quick tasks */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
          {[
            "Morning briefing — pipeline + hot leads",
            "Find 10 epoxy leads in Scottsdale AZ",
            "Run benchmark and self-heal",
            "Generate proposal for top lead",
          ].map(q => (
            <button key={q} onClick={() => setTask(q)} style={{ background: "#0a0a0a", color: "#555", border: "1px solid #1a1a1a", borderRadius: 20, padding: "5px 12px", cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" }}>{q}</button>
          ))}
        </div>

        {/* Results */}
        {result && (
          <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ color: result.status === "completed" ? "#22c55e" : result.status === "partial" ? "#f59e0b" : "#ef4444", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>{result.status || "done"}</span>
              <span style={{ color: "#333", fontSize: 11 }}>{result.total_latency_ms}ms total</span>
            </div>
            <p style={{ color: "#ddd", fontSize: 13, lineHeight: 1.7, margin: "0 0 16px", whiteSpace: "pre-wrap" }}>{result.synthesized_response}</p>
            {result.agents_used && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {result.agents_used.map((a, i) => (
                  <span key={i} style={{ fontSize: 10, color: a.success ? "#22c55e" : "#ef4444", background: a.success ? "#0d1a0d" : "#1a0d0d", padding: "3px 8px", borderRadius: 10 }}>
                    {a.agent} {a.latency_ms}ms
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer nav */}
        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 32 }}>
          {[
            { label: "Studio", href: "/studio" },
            { label: "Workflows", href: "/workflows" },
            { label: "Capabilities", href: "/capabilities" },
            { label: "ChatGPT Setup", href: "/api/openai-setup" },
          ].map(l => (
            <a key={l.href} href={l.href} style={{ color: "#333", fontSize: 12, textDecoration: "none" }}>{l.label}</a>
          ))}
        </div>
      </div>
    </div>
  )
}
