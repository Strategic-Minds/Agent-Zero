"use client"
export const dynamic = "force-dynamic"

import { useState, useEffect } from "react"

interface Workflow {
  id: string; name: string; description: string
  trigger: string; steps: number; version: number
}

interface WorkflowRun {
  run_id: string; workflow_name: string; status: string
  steps_completed: number; steps_total: number; started_at: string
}

const TRIGGER_COLORS: Record<string, string> = {
  cron: "#22c55e", webhook: "#3b82f6", manual: "#f59e0b", pipeline: "#8b5cf6"
}
const STATUS_COLORS: Record<string, string> = {
  completed: "#22c55e", running: "#3b82f6", failed: "#ef4444", pending: "#555"
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)
  const [msg, setMsg] = useState("")

  useEffect(() => {
    Promise.all([
      fetch("/api/workflows").then(r => r.json()),
      fetch("/api/workflows?history=true").then(r => r.json()),
    ]).then(([wfData, histData]) => {
      setWorkflows(wfData.workflows || [])
      setRuns(histData.runs || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const triggerWorkflow = async (id: string) => {
    setRunning(id)
    setMsg("")
    try {
      const r = await fetch(`/api/workflows?secret=${encodeURIComponent(window.location.hostname)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-cron-secret": "demo" },
        body: JSON.stringify({ workflow_id: id }),
      })
      const d = await r.json() as { status?: string; steps_completed?: number; steps_total?: number; error?: string }
      if (d.error) setMsg("Error: " + d.error)
      else setMsg("Completed: " + d.steps_completed + "/" + d.steps_total + " steps — " + d.status)
    } catch (e) { setMsg("Failed: " + String(e).slice(0,60)) }
    setRunning(null)
  }

  if (loading) return <div style={{ background: "#000", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "system-ui" }}>Loading workflows...</div>

  return (
    <div style={{ background: "#000", minHeight: "100vh", color: "#fff", fontFamily: "system-ui,-apple-system,sans-serif", padding: 32 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 900 }}>Workflow Engine</h1>
          <p style={{ margin: 0, color: "#444", fontSize: 13 }}>8 repeatable workflows — automated, self-healing, persistent</p>
          {msg && <div style={{ marginTop: 12, background: "#0d1a0d", border: "1px solid #22c55e30", borderRadius: 8, padding: "10px 16px", color: "#22c55e", fontSize: 13 }}>{msg}</div>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14, marginBottom: 40 }}>
          {workflows.map(wf => {
            const tc = TRIGGER_COLORS[wf.trigger] || "#555"
            const isRunning = running === wf.id
            return (
              <div key={wf.id} style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 12, padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <span style={{ background: tc + "20", color: tc, fontSize: 10, padding: "2px 8px", borderRadius: 12, fontWeight: 700, textTransform: "uppercase" }}>{wf.trigger}</span>
                  <span style={{ color: "#333", fontSize: 10 }}>v{wf.version} · {wf.steps} steps</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#e0e0e0", marginBottom: 5 }}>{wf.name}</div>
                <div style={{ color: "#444", fontSize: 12, lineHeight: 1.5, marginBottom: 14 }}>{wf.description}</div>
                <button
                  onClick={() => triggerWorkflow(wf.id)}
                  disabled={!!running}
                  style={{ width: "100%", background: isRunning ? "#111" : "#fff", color: isRunning ? "#555" : "#000", border: "none", borderRadius: 8, padding: "8px 0", cursor: running ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700 }}
                >
                  {isRunning ? "Running..." : "▶ Run Now"}
                </button>
              </div>
            )
          })}
        </div>

        {runs.length > 0 && (
          <div>
            <div style={{ color: "#333", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Recent Runs</div>
            <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 12, overflow: "hidden" }}>
              {runs.slice(0, 10).map((run, i) => {
                const sc = STATUS_COLORS[run.status] || "#555"
                return (
                  <div key={run.run_id} style={{ padding: "12px 16px", borderBottom: i < runs.length - 1 ? "1px solid #111" : "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13, color: "#ddd" }}>{run.workflow_name}</span>
                      <span style={{ color: "#333", fontSize: 11, marginLeft: 10 }}>{new Date(run.started_at).toLocaleString()}</span>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ color: "#555", fontSize: 11 }}>{run.steps_completed}/{run.steps_total} steps</span>
                      <span style={{ color: sc, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>{run.status}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {runs.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#222", fontSize: 13 }}>No workflow runs yet — click Run Now on any workflow above</div>
        )}
      </div>
    </div>
  )
}
