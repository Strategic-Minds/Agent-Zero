/**
 * ENTERPRISE CHAT UI — Agent Zero Command Center
 * ChatGPT-style dark interface with agent selector + tool use display
 */
"use client"
import { useState, useRef, useEffect } from "react"

interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  tools_used?: string[]
  model?: string
  latency_ms?: number
  agent?: string
  timestamp: string
}

const AGENTS = [
  { id: "aria", name: "ARIA", icon: "🎯", desc: "Lead AI — CRM, research, reports" },
  { id: "apex", name: "APEX", icon: "⚡", desc: "Code & self-improvement engine" },
  { id: "ghost", name: "GHOST", icon: "👁️", desc: "Intel & competitor analysis" },
  { id: "swarm", name: "SWARM", icon: "🌐", desc: "Parallel multi-agent execution" },
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "sys-1",
      role: "system",
      content: "Agent Zero Enterprise Online. ARIA, APEX, GHOST, and SWARM ready. Select an agent or type to route automatically.",
      timestamp: new Date().toISOString(),
    }
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [activeAgent, setActiveAgent] = useState("aria")
  const [showTools, setShowTools] = useState(true)
  const [sessionId] = useState(() => `session_${Date.now()}`)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    const sentInput = input
    setInput("")
    setLoading(true)

    try {
      const endpoint = activeAgent === "swarm" ? "/api/swarm" : "/api/aria"
      const body = activeAgent === "swarm"
        ? { tasks: [{ id: "t1", agent: "ARIA", instruction: sentInput, priority: 5 }], strategy: "parallel" }
        : { message: sentInput, channel: "web", session_id: sessionId, agent: activeAgent }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${document.cookie.split("bridge_secret=")?.[1]?.split(";")?.[0] || ""}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90000),
      })

      const data = await res.json() as {
        response?: string; tools_used?: string[]; model?: string; latency_ms?: number
        summary?: string; results?: unknown[]
      }

      const assistantMsg: Message = {
        id: `msg_${Date.now()}_a`,
        role: "assistant",
        content: data.response || data.summary || JSON.stringify(data).slice(0, 500),
        tools_used: data.tools_used || [],
        model: data.model || "auto",
        latency_ms: data.latency_ms,
        agent: activeAgent.toUpperCase(),
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (e) {
      setMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        role: "assistant",
        content: `⚠️ Error: ${String(e).slice(0, 150)}`,
        agent: activeAgent.toUpperCase(),
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0a0a14", color: "#e0e0e0", fontFamily: "system-ui, sans-serif" }}>
      
      {/* SIDEBAR */}
      <div style={{ width: 260, background: "#0d1117", borderRight: "1px solid #1e2a3a", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 16px", borderBottom: "1px solid #1e2a3a" }}>
          <div style={{ color: "#00d4a0", fontWeight: 800, fontSize: 18, letterSpacing: 1 }}>⬡ AGENT ZERO</div>
          <div style={{ color: "#555", fontSize: 11, marginTop: 4 }}>Enterprise Command Center</div>
        </div>
        
        <div style={{ padding: 16 }}>
          <div style={{ color: "#555", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>ACTIVE AGENT</div>
          {AGENTS.map(a => (
            <button key={a.id} onClick={() => setActiveAgent(a.id)} style={{
              width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 8, marginBottom: 6, cursor: "pointer",
              background: activeAgent === a.id ? "#00d4a010" : "transparent",
              border: activeAgent === a.id ? "1px solid #00d4a040" : "1px solid transparent",
              color: activeAgent === a.id ? "#00d4a0" : "#888",
            }}>
              <span style={{ marginRight: 8 }}>{a.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{a.name}</span>
              <div style={{ fontSize: 10, color: "#555", marginTop: 2, paddingLeft: 22 }}>{a.desc}</div>
            </button>
          ))}
        </div>

        <div style={{ padding: "0 16px" }}>
          <div style={{ color: "#555", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>QUICK COMMANDS</div>
          {[
            { label: "📊 Daily Briefing", cmd: "Use system_status and generate_report for today's briefing" },
            { label: "🎯 Top Leads", cmd: "Use db_read to show top 5 priority-1 leads" },
            { label: "⚡ Lead Blitz", cmd: "Use generate_report type=leads format=whatsapp" },
            { label: "🔧 System Status", cmd: "Use system_status tool now" },
            { label: "🏆 Run Benchmark", cmd: "Run benchmark test" },
          ].map(q => (
            <button key={q.label} onClick={() => { setInput(q.cmd); inputRef.current?.focus() }} style={{
              width: "100%", textAlign: "left", padding: "7px 12px", borderRadius: 6, marginBottom: 4, cursor: "pointer",
              background: "transparent", border: "none", color: "#666", fontSize: 12, transition: "color 0.2s",
            }} onMouseOver={e => (e.currentTarget.style.color = "#00d4a0")} onMouseOut={e => (e.currentTarget.style.color = "#666")}>
              {q.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: "auto", padding: 16, borderTop: "1px solid #1e2a3a" }}>
          <a href="/dashboard" style={{ color: "#555", fontSize: 12, textDecoration: "none", display: "block", marginBottom: 6 }}>📈 Dashboard</a>
          <a href="/benchmark" style={{ color: "#555", fontSize: 12, textDecoration: "none", display: "block" }}>🧪 Benchmark Lab</a>
        </div>
      </div>

      {/* CHAT AREA */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        
        {/* Top bar */}
        <div style={{ padding: "12px 24px", borderBottom: "1px solid #1e2a3a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "#00d4a0", fontSize: 20 }}>{AGENTS.find(a=>a.id===activeAgent)?.icon}</span>
            <span style={{ fontWeight: 700, color: "#e0e0e0" }}>{AGENTS.find(a=>a.id===activeAgent)?.name}</span>
            <span style={{ background: "#00d4a020", color: "#00d4a0", fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>ONLINE</span>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#555", cursor: "pointer" }}>
            <input type="checkbox" checked={showTools} onChange={e=>setShowTools(e.target.checked)} style={{ cursor: "pointer" }} />
            Show tool calls
          </label>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ display: "flex", gap: 12, justifyContent: msg.role === "user" ? "flex-end" : "flex-start", maxWidth: "100%" }}>
              {msg.role !== "user" && (
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: msg.role === "system" ? "#1e2a3a" : "#00d4a020", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                  {msg.role === "system" ? "⬡" : AGENTS.find(a=>a.id===activeAgent)?.icon}
                </div>
              )}
              <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", gap: 4, alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  background: msg.role === "user" ? "#00d4a0" : msg.role === "system" ? "#1e2a3a" : "#0d1117",
                  color: msg.role === "user" ? "#0a0a14" : "#e0e0e0",
                  padding: "12px 16px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                  fontSize: 14, lineHeight: 1.6, border: msg.role === "user" ? "none" : "1px solid #1e2a3a",
                  whiteSpace: "pre-wrap",
                }}>
                  {msg.content}
                </div>
                {showTools && msg.tools_used && msg.tools_used.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {msg.tools_used.map(t => (
                      <span key={t} style={{ background: "#1e2a3a", color: "#00d4a0", fontSize: 10, padding: "2px 8px", borderRadius: 20, fontFamily: "monospace" }}>🔧 {t}</span>
                    ))}
                  </div>
                )}
                <div style={{ color: "#444", fontSize: 10 }}>
                  {msg.agent && <span style={{ marginRight: 8 }}>{msg.agent}</span>}
                  {msg.model && <span style={{ marginRight: 8 }}>{msg.model}</span>}
                  {msg.latency_ms && <span>{(msg.latency_ms/1000).toFixed(1)}s</span>}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#00d4a020", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {AGENTS.find(a=>a.id===activeAgent)?.icon}
              </div>
              <div style={{ background: "#0d1117", border: "1px solid #1e2a3a", padding: "12px 16px", borderRadius: "4px 18px 18px 18px", display: "flex", gap: 4, alignItems: "center" }}>
                <span style={{ color: "#00d4a0", fontSize: 13 }}>Thinking</span>
                {[0,1,2].map(i => (
                  <span key={i} style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#00d4a0", animation: `pulse 1s ${i*0.2}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #1e2a3a" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", background: "#0d1117", border: "1px solid #1e2a3a", borderRadius: 16, padding: "12px 16px" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={`Message ${AGENTS.find(a=>a.id===activeAgent)?.name}... (Enter to send, Shift+Enter for newline)`}
              disabled={loading}
              rows={1}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none", color: "#e0e0e0",
                fontSize: 14, resize: "none", lineHeight: 1.5, fontFamily: "inherit",
              }}
              onInput={e => {
                const t = e.currentTarget
                t.style.height = "auto"
                t.style.height = Math.min(t.scrollHeight, 150) + "px"
              }}
            />
            <button onClick={sendMessage} disabled={loading || !input.trim()} style={{
              background: loading || !input.trim() ? "#1e2a3a" : "#00d4a0",
              color: loading || !input.trim() ? "#555" : "#0a0a14",
              border: "none", borderRadius: 10, padding: "8px 16px",
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              fontWeight: 700, fontSize: 13, flexShrink: 0,
            }}>
              {loading ? "..." : "Send ↑"}
            </button>
          </div>
          <div style={{ textAlign: "center", color: "#333", fontSize: 10, marginTop: 8 }}>
            Agent Zero v2.0 · {AGENTS.find(a=>a.id===activeAgent)?.name} · Session {sessionId.split("_")[1]}
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }`}</style>
    </div>
  )
}
