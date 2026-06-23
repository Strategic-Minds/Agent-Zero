"use client";
import { useState, useEffect } from "react";

const ACTIONS = [
  { id: "lead_discovery",  label: "Lead Discovery",        desc: "Scrape new AZ epoxy leads" },
  { id: "lead_scoring",    label: "Lead Scoring",           desc: "AI score all unscored leads" },
  { id: "whatsapp_brief",  label: "WhatsApp Daily Brief",   desc: "Send top 5 leads via WhatsApp" },
  { id: "outreach",        label: "Email Outreach",         desc: "Send pitch emails to A-tier leads" },
  { id: "daily_report",    label: "Daily Report",           desc: "Full pipeline summary" },
  { id: "slack_alerts",    label: "Slack Alerts",           desc: "Post new leads to #xps-leads" },
];

type ActionMap = Record<string, boolean>;

interface SystemState {
  master: boolean;
  actions: ActionMap;
  last_updated: string;
}

interface HealthData {
  status: string;
  version?: string;
  uptime_seconds?: number;
  checks?: Record<string, boolean>;
}

export default function Dashboard() {
  const [state,    setState]    = useState<SystemState>({ master: false, actions: {}, last_updated: "" });
  const [health,   setHealth]   = useState<HealthData>({ status: "loading" });
  const [loading,  setLoading]  = useState(true);
  const [lastRun,  setLastRun]  = useState<string>("");
  const [runResult, setRunResult] = useState<string>("");

  useEffect(() => {
    loadState();
    loadHealth();
    const t = setInterval(() => { loadHealth(); }, 30000);
    return () => clearInterval(t);
  }, []);

  async function loadState() {
    try {
      const r = await fetch("/api/system-control");
      const d = await r.json() as { system_state: SystemState };
      setState(d.system_state);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function loadHealth() {
    try {
      const r = await fetch("/api/health");
      const d = await r.json() as HealthData;
      setHealth(d);
    } catch { setHealth({ status: "error" }); }
  }

  async function toggleMaster(on: boolean) {
    setLoading(true);
    await fetch("/api/system-control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ master: on }),
    });
    await loadState();
  }

  async function toggleAction(id: string, enabled: boolean) {
    await fetch("/api/system-control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: id, enabled }),
    });
    setState(prev => ({ ...prev, actions: { ...prev.actions, [id]: enabled } }));
  }

  async function triggerNow(id: string) {
    setLastRun(id);
    setRunResult("Running...");
    const r = await fetch("/api/system-control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger_now: id }),
    });
    const d = await r.json() as { message?: string };
    setRunResult(d.message || "Done");
    setTimeout(() => setRunResult(""), 4000);
  }

  const statusColor = health.status === "ok" ? "#16a34a" : health.status === "loading" ? "#d97706" : "#dc2626";

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif", color: "#111827" }}>
      {/* TOP BAR */}
      <div style={{ background: "#1e293b", padding: "14px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, background: "#3b82f6", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16 }}>X</div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>XPS Agent Zero</div>
            <div style={{ color: "#94a3b8", fontSize: 12 }}>Operational Dashboard</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor }} />
          <span style={{ color: "#94a3b8", fontSize: 13 }}>{health.version || "v7.6.1"} &mdash; {health.status}</span>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

        {/* MASTER SWITCH */}
        <div style={{ background: state.master ? "#f0fdf4" : "#fff7ed", border: "1.5px solid " + (state.master ? "#86efac" : "#fdba74"), borderRadius: 12, padding: "24px 28px", marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#111827" }}>System Master Switch</div>
            <div style={{ color: "#6b7280", fontSize: 14, marginTop: 4 }}>
              {state.master ? "SYSTEM ACTIVE — automated actions are running on schedule" : "SYSTEM OFF — all automated actions are paused"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => toggleMaster(false)}
              style={{ padding: "10px 24px", borderRadius: 8, border: "1.5px solid #f87171", background: state.master ? "#fff" : "#fef2f2", color: "#dc2626", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              OFF
            </button>
            <button
              onClick={() => toggleMaster(true)}
              style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: state.master ? "#16a34a" : "#d1d5db", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              ON
            </button>
          </div>
        </div>

        {/* HEALTH CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
          {[
            { label: "System Status", value: health.status === "ok" ? "Online" : health.status, color: statusColor },
            { label: "AI Provider",   value: (health.checks?.groq ? "Groq" : "Offline"), color: health.checks?.groq ? "#16a34a" : "#dc2626" },
            { label: "Database",      value: (health.checks?.supabase ? "Connected" : "Offline"), color: health.checks?.supabase ? "#16a34a" : "#dc2626" },
            { label: "Last Updated",  value: state.last_updated ? new Date(state.last_updated).toLocaleTimeString() : "—", color: "#6b7280" },
          ].map(c => (
            <div key={c.label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "18px 20px" }}>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{c.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* ACTION CONTROLS */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Automated Actions</div>
          <div style={{ color: "#6b7280", fontSize: 13 }}>Toggle individual actions or trigger manually. Master switch must be ON for scheduled runs.</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 28 }}>
          {ACTIONS.map(a => {
            const enabled = state.actions?.[a.id] ?? false;
            const isRunning = lastRun === a.id && runResult === "Running...";
            return (
              <div key={a.id} style={{ background: "#fff", border: "1.5px solid " + (enabled ? "#bfdbfe" : "#e2e8f0"), borderRadius: 10, padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{a.label}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>{a.desc}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => triggerNow(a.id)}
                    style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #d1d5db", background: "#f8fafc", color: "#374151", fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
                    {isRunning ? "..." : "Run Now"}
                  </button>
                  <button
                    onClick={() => toggleAction(a.id, !enabled)}
                    style={{ width: 44, height: 24, borderRadius: 12, border: "none", background: enabled ? "#3b82f6" : "#d1d5db", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                    <span style={{ position: "absolute", top: 2, left: enabled ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* MANUAL ACTION SELECTOR */}
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Manual Action Selector</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <select
              id="actionSelect"
              style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1.5px solid #d1d5db", fontSize: 14, background: "#fff", color: "#111827" }}>
              <option value="">-- Select an action to run --</option>
              {ACTIONS.map(a => (
                <option key={a.id} value={a.id}>{a.label} — {a.desc}</option>
              ))}
            </select>
            <button
              onClick={() => {
                const sel = (document.getElementById("actionSelect") as HTMLSelectElement)?.value;
                if (sel) triggerNow(sel);
              }}
              style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#1e293b", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14, whiteSpace: "nowrap" }}>
              Execute
            </button>
          </div>
          {runResult && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, fontSize: 13, color: "#15803d" }}>
              {lastRun}: {runResult}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
