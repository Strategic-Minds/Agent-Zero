"use client"
export const dynamic = "force-dynamic"

import { useState, useRef, useEffect } from "react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  artifact?: Artifact
  timestamp: string
}

interface Artifact {
  type: "html" | "svg" | "code"
  language?: string
  content: string
  title: string
}

type Tab = "preview" | "code"

const TICK3 = "```"

function detectArtifact(content: string): Artifact | null {
  const htmlRe = new RegExp(TICK3 + "html\\n([\\s\\S]*?)" + TICK3, "i")
  const htmlMatch = content.match(htmlRe)
  if (htmlMatch) return { type: "html", content: htmlMatch[1], title: "Web Page" }

  const svgRe = new RegExp(TICK3 + "svg\\n([\\s\\S]*?)" + TICK3, "i")
  const svgMatch = content.match(svgRe)
  if (svgMatch) return { type: "svg", content: svgMatch[1], title: "Logo / SVG" }

  const rawSvg = content.match(/(<svg[\s\S]*?<\/svg>)/i)
  if (rawSvg) return { type: "svg", content: rawSvg[1], title: "Logo / SVG" }

  const codeRe = new RegExp(TICK3 + "(\\w+)\\n([\\s\\S]*?)" + TICK3)
  const codeMatch = content.match(codeRe)
  if (codeMatch) return { type: "code", language: codeMatch[1], content: codeMatch[2], title: codeMatch[1].toUpperCase() + " Code" }

  if (/<html|<!DOCTYPE|<body/.test(content)) {
    return { type: "html", content: content, title: "Generated UI" }
  }

  return null
}

function ArtifactPreview({ artifact, tab }: { artifact: Artifact; tab: Tab }) {
  if (tab === "code") {
    return (
      <pre style={{
        margin: 0, padding: "20px 24px", fontSize: 13, lineHeight: 1.7,
        color: "#e2e8f0", fontFamily: "monospace",
        overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
        height: "100%", background: "transparent",
      }}>
        <code>{artifact.content}</code>
      </pre>
    )
  }

  if (artifact.type === "svg") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "#111", padding: 40 }}>
        <div dangerouslySetInnerHTML={{ __html: artifact.content }} style={{ maxWidth: "80%", maxHeight: "80%" }} />
      </div>
    )
  }

  if (artifact.type === "html") {
    const fullHtml = artifact.content.includes("<html") ? artifact.content :
      "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif}</style></head><body>" +
      artifact.content + "</body></html>"
    return (
      <iframe
        srcDoc={fullHtml}
        sandbox="allow-scripts allow-same-origin"
        style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
        title="Preview"
      />
    )
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#555" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
        <div style={{ fontSize: 14 }}>{artifact.title}</div>
      </div>
    </div>
  )
}

export default function StudioPage() {
  const [messages, setMessages] = useState<Message[]>([{
    id: "welcome", role: "assistant",
    content: "What would you like to build? I can create websites, logos, UI components, dashboards — all rendered live in the editor.",
    timestamp: new Date().toISOString(),
  }])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>("preview")
  const [editorOpen, setEditorOpen] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { id: "u_" + Date.now(), role: "user", content: input, timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    const text = input
    setInput("")
    setLoading(true)
    try {
      const res = await fetch("/api/aria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, channel: "studio", session_id: "studio" }),
        signal: AbortSignal.timeout(90000),
      })
      const data = await res.json() as { response?: string }
      const response = data.response || "Error generating response."
      const artifact = detectArtifact(response)

      const display = response.replace(new RegExp(TICK3 + "[\\s\\S]*?" + TICK3, "g"), "[Code generated — see editor →]").trim()

      setMessages(prev => [...prev, {
        id: "a_" + Date.now(), role: "assistant", content: display,
        artifact: artifact || undefined, timestamp: new Date().toISOString(),
      }])
      if (artifact) { setActiveArtifact(artifact); setActiveTab("preview"); setEditorOpen(true) }
    } catch (e) {
      setMessages(prev => [...prev, { id: "e_" + Date.now(), role: "assistant", content: "Error: " + String(e).slice(0,100), timestamp: new Date().toISOString() }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() } }

  const quickPrompts = [
    "Build a SaaS landing page with dark theme, hero, features section, pricing",
    "Create a professional SVG logo for XPS Intelligence — epoxy flooring company, gold + black",
    "Build a CRM dashboard with sidebar, stat cards, leads table",
    "Create an animated hero section with gradient background",
    "Build a mobile-first construction app UI with job cards",
  ]

  return (
    <div style={{ display: "flex", height: "100vh", background: "#000", color: "#fff", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", overflow: "hidden" }}>

      {/* LEFT: CHAT */}
      <div style={{ width: editorOpen ? 420 : "100%", minWidth: editorOpen ? 380 : undefined, display: "flex", flexDirection: "column", borderRight: editorOpen ? "1px solid #1a1a1a" : "none" }}>

        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, background: "#fff", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontSize: 14, fontWeight: 900 }}>⬡</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Agent Zero Studio</div>
              <div style={{ color: "#444", fontSize: 10 }}>Build anything • Live preview</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
            <button onClick={() => setEditorOpen(!editorOpen)} style={{ background: "#111", border: "1px solid #222", color: "#666", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>
              {editorOpen ? "Hide" : "Editor"}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 0" }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ marginBottom: 18, display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: 8, alignItems: "flex-start" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: msg.role === "user" ? "#fff" : "#111", border: msg.role === "assistant" ? "1px solid #222" : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: msg.role === "user" ? "#000" : "#fff", fontWeight: 700 }}>
                {msg.role === "user" ? "J" : "⬡"}
              </div>
              <div style={{ maxWidth: "88%", display: "flex", flexDirection: "column", gap: 5, alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ background: msg.role === "user" ? "#fff" : "#0d0d0d", color: msg.role === "user" ? "#000" : "#ddd", padding: "9px 13px", borderRadius: msg.role === "user" ? "14px 14px 3px 14px" : "3px 14px 14px 14px", fontSize: 13, lineHeight: 1.6, border: msg.role === "assistant" ? "1px solid #1a1a1a" : "none", whiteSpace: "pre-wrap" }}>
                  {msg.content}
                </div>
                {msg.artifact && (
                  <button onClick={() => { setActiveArtifact(msg.artifact!); setActiveTab("preview"); setEditorOpen(true) }}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 8, padding: "5px 11px", cursor: "pointer", color: "#aaa", fontSize: 11 }}>
                    {msg.artifact.type === "svg" ? "🎨" : msg.artifact.type === "html" ? "🌐" : "💻"}
                    <span style={{ color: "#666" }}>{msg.artifact.title}</span>
                    <span style={{ color: "#444" }}>→</span>
                  </button>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#111", border: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>⬡</div>
              <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", padding: "9px 14px", borderRadius: "3px 14px 14px 14px", display: "flex", gap: 4, alignItems: "center" }}>
                <span style={{ color: "#444", fontSize: 11 }}>Building</span>
                {[0,1,2].map(i => <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: "#fff", display: "inline-block" }} />)}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick prompts */}
        {messages.length <= 1 && (
          <div style={{ padding: "10px 14px" }}>
            <div style={{ color: "#2a2a2a", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Quick builds</div>
            {quickPrompts.map(p => (
              <button key={p} onClick={() => setInput(p)} style={{ display: "block", width: "100%", textAlign: "left", background: "#080808", border: "1px solid #151515", borderRadius: 8, padding: "7px 11px", cursor: "pointer", color: "#555", fontSize: 11, lineHeight: 1.4, marginBottom: 4 }}>
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ padding: "10px 14px 14px" }}>
          <div style={{ background: "#080808", border: "1px solid #1a1a1a", borderRadius: 12, padding: "9px 10px", display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder="Build me a website, logo, dashboard..." disabled={loading} rows={1}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 13, resize: "none", lineHeight: 1.5, fontFamily: "inherit" }}
              onInput={e => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 100) + "px" }}
            />
            <button onClick={sendMessage} disabled={loading || !input.trim()} style={{ background: loading || !input.trim() ? "#111" : "#fff", color: loading || !input.trim() ? "#333" : "#000", border: "none", borderRadius: 8, width: 30, height: 30, cursor: loading || !input.trim() ? "not-allowed" : "pointer", fontWeight: 900, fontSize: 15, flexShrink: 0 }}>
              ↑
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: EDITOR */}
      {editorOpen && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#080808", minWidth: 0 }}>
          <div style={{ height: 50, borderBottom: "1px solid #1a1a1a", padding: "0 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <span style={{ color: "#444", fontSize: 12, fontFamily: "monospace" }}>{activeArtifact ? activeArtifact.title : "editor"}</span>
            {activeArtifact && (
              <div style={{ display: "flex", gap: 2, background: "#111", border: "1px solid #1a1a1a", borderRadius: 8, padding: 3 }}>
                {(["preview", "code"] as Tab[]).map(t => (
                  <button key={t} onClick={() => setActiveTab(t)} style={{ background: activeTab === t ? "#fff" : "transparent", color: activeTab === t ? "#000" : "#555", border: "none", borderRadius: 6, padding: "3px 12px", cursor: "pointer", fontSize: 11, fontWeight: activeTab === t ? 700 : 400 }}>
                    {t === "preview" ? "▶ Preview" : "{ } Code"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            {activeArtifact ? (
              <ArtifactPreview artifact={activeArtifact} tab={activeTab} />
            ) : (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
                <div style={{ color: "#111", fontSize: 100, lineHeight: 1 }}>⬡</div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "#2a2a2a", fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Editor ready</div>
                  <div style={{ color: "#1e1e1e", fontSize: 12 }}>Ask me to build something — it renders here instantly</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["Website", "Logo", "Dashboard", "Component"].map(t => (
                    <span key={t} style={{ background: "#0d0d0d", border: "1px solid #151515", color: "#2a2a2a", padding: "3px 10px", borderRadius: 16, fontSize: 10 }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`*{box-sizing:border-box}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#1a1a1a;border-radius:2px}`}</style>
    </div>
  )
}
