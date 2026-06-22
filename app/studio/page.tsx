"use client"
export const dynamic = "force-dynamic"

import { useState, useRef, useEffect, useCallback } from "react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  artifact?: Artifact
  timestamp: string
}

interface Artifact {
  type: "html" | "react" | "image" | "svg" | "code"
  language?: string
  content: string
  title: string
}

type Tab = "preview" | "code"

function detectArtifact(content: string): Artifact | null {
  // Detect HTML page/website
  const htmlMatch = content.match(/```html
([\s\S]*?)```/i)
  if (htmlMatch) return { type: "html", content: htmlMatch[1], title: "Web Page" }

  // Detect SVG logo
  const svgMatch = content.match(/```svg
([\s\S]*?)```/i) || content.match(/(<svg[\s\S]*?<\/svg>)/i)
  if (svgMatch) return { type: "svg", content: svgMatch[1], title: "Logo / SVG" }

  // Detect React component
  const reactMatch = content.match(/```(?:tsx|jsx)
([\s\S]*?)```/i)
  if (reactMatch) return { type: "react", content: reactMatch[1], title: "React Component" }

  // Detect any code block
  const codeMatch = content.match(/```(\w+)
([\s\S]*?)```/)
  if (codeMatch) return { type: "code", language: codeMatch[1], content: codeMatch[2], title: `${codeMatch[1].toUpperCase()} Code` }

  // Detect raw HTML (contains tags)
  if (/<html|<!DOCTYPE|<body|<div.*>|<svg/.test(content)) {
    const htmlContent = content.replace(/^[\s\S]*?(<(?:html|!DOCTYPE|svg))/i, "$1")
    return { type: "html", content: htmlContent, title: "Generated UI" }
  }

  return null
}

function ArtifactPreview({ artifact, tab }: { artifact: Artifact; tab: Tab }) {
  if (tab === "code") {
    return (
      <pre style={{
        margin: 0, padding: "20px 24px", fontSize: 13, lineHeight: 1.7,
        color: "#e2e8f0", fontFamily: "'Fira Code', 'Cascadia Code', monospace",
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

  if (artifact.type === "html" || artifact.type === "react") {
    const fullHtml = artifact.content.includes("<html") ? artifact.content : `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; }
</style>
</head>
<body>
${artifact.content}
</body>
</html>`
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "What would you like to build? I can create websites, logos, UI components, SVGs, dashboards, landing pages, and more — all rendered live in the editor.",
      timestamp: new Date().toISOString(),
    }
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>("preview")
  const [editorOpen, setEditorOpen] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const SYSTEM_PROMPT = `You are Agent Zero Studio — an expert full-stack developer and designer.
When the user asks for a website, UI, logo, component, dashboard, landing page, or any visual output:
1. Generate complete, beautiful, production-ready HTML/CSS/JS (or SVG for logos)
2. Always wrap HTML in \`\`\`html ... \`\`\` code blocks
3. Always wrap SVG logos in \`\`\`svg ... \`\`\` code blocks  
4. Make designs stunning: use gradients, glassmorphism, modern typography, animations
5. Include all CSS inline or in <style> tags — no external dependencies
6. For logos: generate clean SVG with professional design
7. For websites: generate complete pages with navigation, hero, sections, footer
8. Always explain what you built BEFORE the code block
9. Make it immediately usable — no placeholder content

Design style: Modern, clean, dark/light modes, professional. Think Stripe, Linear, Vercel aesthetics.`

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    const text = input
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/aria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          channel: "studio",
          system_override: SYSTEM_PROMPT,
          session_id: "studio",
        }),
        signal: AbortSignal.timeout(90000),
      })
      const data = await res.json() as { response?: string; error?: string }
      const response = data.response || "Sorry, I had trouble generating that."
      const artifact = detectArtifact(response)

      const assistantMsg: Message = {
        id: `a_${Date.now()}`,
        role: "assistant",
        content: response,
        artifact: artifact || undefined,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])

      if (artifact) {
        setActiveArtifact(artifact)
        setActiveTab("preview")
        setEditorOpen(true)
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        id: `e_${Date.now()}`,
        role: "assistant",
        content: `Error: ${String(e).slice(0, 100)}`,
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

  const quickPrompts = [
    "Build me a SaaS landing page with dark theme, hero, features, pricing",
    "Create a professional logo SVG for XPS Intelligence — epoxy flooring company",
    "Build a CRM dashboard with sidebar, stats cards, lead table",
    "Create a gradient hero section with animated particles",
    "Build a mobile app UI for a construction management app",
    "Create an animated SVG logo with gold and black — luxury brand",
  ]

  // Strip code blocks from display content
  const displayContent = (content: string) =>
    content.replace(/```[\s\S]*?```/g, "[Code generated — see editor →]").trim()

  return (
    <div style={{
      display: "flex", height: "100vh", background: "#000", color: "#fff",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", overflow: "hidden",
    }}>

      {/* ── LEFT: CHAT ─────────────────────────────────────────────────── */}
      <div style={{
        width: editorOpen ? 420 : "100%",
        minWidth: editorOpen ? 380 : undefined,
        display: "flex", flexDirection: "column",
        borderRight: editorOpen ? "1px solid #1a1a1a" : "none",
        transition: "width 0.2s ease",
      }}>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, background: "#fff", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#000", fontSize: 14, fontWeight: 900 }}>⬡</span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.3 }}>Agent Zero Studio</div>
              <div style={{ color: "#555", fontSize: 10 }}>Build anything • See it instantly</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
            <span style={{ color: "#555", fontSize: 11 }}>Live</span>
            <button onClick={() => setEditorOpen(!editorOpen)} style={{
              marginLeft: 8, background: "#111", border: "1px solid #222", color: "#888",
              borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11,
            }}>
              {editorOpen ? "Hide Editor" : "Show Editor"}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 0" }}>
          {messages.map(msg => (
            <div key={msg.id} style={{
              marginBottom: 20,
              display: "flex",
              flexDirection: msg.role === "user" ? "row-reverse" : "row",
              gap: 10,
              alignItems: "flex-start",
            }}>
              {/* Avatar */}
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                background: msg.role === "user" ? "#fff" : "#111",
                border: msg.role === "assistant" ? "1px solid #222" : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, color: msg.role === "user" ? "#000" : "#fff",
                fontWeight: 700,
              }}>
                {msg.role === "user" ? "J" : "⬡"}
              </div>

              <div style={{ maxWidth: "85%", display: "flex", flexDirection: "column", gap: 6, alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  background: msg.role === "user" ? "#fff" : "#0f0f0f",
                  color: msg.role === "user" ? "#000" : "#e2e8f0",
                  padding: "10px 14px", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
                  fontSize: 13, lineHeight: 1.6,
                  border: msg.role === "assistant" ? "1px solid #1a1a1a" : "none",
                  whiteSpace: "pre-wrap",
                }}>
                  {displayContent(msg.content)}
                </div>

                {/* Artifact pill */}
                {msg.artifact && (
                  <button
                    onClick={() => { setActiveArtifact(msg.artifact!); setActiveTab("preview"); setEditorOpen(true) }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: "#0f0f0f", border: "1px solid #222",
                      borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "#e2e8f0",
                      fontSize: 12,
                    }}
                  >
                    <span>{msg.artifact.type === "svg" ? "🎨" : msg.artifact.type === "html" ? "🌐" : "💻"}</span>
                    <span style={{ color: "#a3a3a3" }}>{msg.artifact.title}</span>
                    <span style={{ color: "#555", marginLeft: 4 }}>→ View</span>
                  </button>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "flex-start" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#111", border: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>⬡</div>
              <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", padding: "10px 16px", borderRadius: "4px 16px 16px 16px", display: "flex", gap: 5, alignItems: "center" }}>
                <span style={{ color: "#555", fontSize: 12 }}>Generating</span>
                {[0,1,2].map(i => (
                  <span key={i} style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "#fff", opacity: 0.3, animation: `blink 1.2s ${i * 0.2}s infinite ease-in-out` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick prompts */}
        {messages.length <= 1 && (
          <div style={{ padding: "12px 20px" }}>
            <div style={{ color: "#333", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Quick builds</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {quickPrompts.map(p => (
                <button key={p} onClick={() => setInput(p)} style={{
                  textAlign: "left", background: "#0a0a0a", border: "1px solid #1a1a1a",
                  borderRadius: 8, padding: "8px 12px", cursor: "pointer", color: "#888",
                  fontSize: 12, lineHeight: 1.4,
                }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div style={{ padding: "12px 16px 16px" }}>
          <div style={{
            background: "#0a0a0a", border: "1px solid #222", borderRadius: 12,
            padding: "10px 12px", display: "flex", gap: 10, alignItems: "flex-end",
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Build me a website, logo, dashboard..."
              disabled={loading}
              rows={1}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: "#fff", fontSize: 13, resize: "none", lineHeight: 1.5,
                fontFamily: "inherit", maxHeight: 120,
              }}
              onInput={e => {
                const t = e.currentTarget
                t.style.height = "auto"
                t.style.height = Math.min(t.scrollHeight, 120) + "px"
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                background: loading || !input.trim() ? "#111" : "#fff",
                color: loading || !input.trim() ? "#333" : "#000",
                border: "none", borderRadius: 8, width: 32, height: 32, cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                fontWeight: 900, fontSize: 16, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              ↑
            </button>
          </div>
          <div style={{ textAlign: "center", color: "#222", fontSize: 10, marginTop: 6 }}>
            Enter ↵ to send · Shift+Enter for new line
          </div>
        </div>
      </div>

      {/* ── RIGHT: EDITOR / PREVIEW ─────────────────────────────────────── */}
      {editorOpen && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#0a0a0a", minWidth: 0 }}>

          {/* Editor header */}
          <div style={{ padding: "0 20px", height: 52, borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* File name */}
              <span style={{ color: "#666", fontSize: 12, fontFamily: "monospace" }}>
                {activeArtifact ? activeArtifact.title : "No artifact"}
              </span>
              {activeArtifact && (
                <span style={{ background: "#111", border: "1px solid #222", color: "#555", fontSize: 10, padding: "2px 8px", borderRadius: 20 }}>
                  {activeArtifact.type.toUpperCase()}
                </span>
              )}
            </div>

            {activeArtifact && (
              <div style={{ display: "flex", gap: 2, background: "#111", border: "1px solid #222", borderRadius: 8, padding: 3 }}>
                {(["preview", "code"] as Tab[]).map(t => (
                  <button key={t} onClick={() => setActiveTab(t)} style={{
                    background: activeTab === t ? "#fff" : "transparent",
                    color: activeTab === t ? "#000" : "#666",
                    border: "none", borderRadius: 6, padding: "4px 14px",
                    cursor: "pointer", fontSize: 12, fontWeight: activeTab === t ? 700 : 400,
                  }}>
                    {t === "preview" ? "▶ Preview" : "{ } Code"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Editor body */}
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            {activeArtifact ? (
              <ArtifactPreview artifact={activeArtifact} tab={activeTab} />
            ) : (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
                <div style={{ color: "#1a1a1a", fontSize: 120, lineHeight: 1 }}>⬡</div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "#333", fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Editor ready</div>
                  <div style={{ color: "#222", fontSize: 13 }}>Ask me to build a website, logo, dashboard,</div>
                  <div style={{ color: "#222", fontSize: 13 }}>UI component, or anything visual</div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  {["HTML", "SVG", "React", "CSS"].map(t => (
                    <span key={t} style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", color: "#333", padding: "4px 12px", borderRadius: 20, fontSize: 11 }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }
        textarea { scrollbar-width: thin; scrollbar-color: #222 transparent; }
        @keyframes blink { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }
        button:hover { opacity: 0.85; }
      `}</style>
    </div>
  )
}
