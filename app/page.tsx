/**
 * AGENT ZERO — Enterprise Home Page
 * Links to all system capabilities
 */
import Link from "next/link"

export default function Home() {
  const modules = [
    { href: "/chat", icon: "💬", title: "ARIA Chat", desc: "Enterprise AI command interface", badge: "LIVE" },
    { href: "/dashboard", icon: "📊", title: "Dashboard", desc: "Pipeline, leads, analytics", badge: "LIVE" },
    { href: "/benchmark", icon: "🧪", title: "Benchmark Lab", desc: "GAIA+AgentBench+SWE-bench tests", badge: "V3" },
    { href: "/api/health", icon: "💚", title: "System Health", desc: "All agents + env status", badge: "API" },
    { href: "/api/swarm", icon: "🌐", title: "Swarm API", desc: "Parallel multi-agent execution", badge: "NEW" },
    { href: "/api/aria", icon: "🎯", title: "ARIA API", desc: "20-tool autonomous agent", badge: "API" },
    { href: "/api/apex", icon: "⚡", title: "APEX API", desc: "Code + self-improvement", badge: "API" },
    { href: "/api/benchmark", icon: "🏆", title: "Run Benchmark", desc: "Full 30-capability test suite", badge: "30 TESTS" },
  ]

  return (
    <div style={{ background: "#0a0a14", minHeight: "100vh", color: "#e0e0e0", fontFamily: "system-ui, sans-serif", padding: 40 }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>⬡</div>
          <h1 style={{ color: "#00d4a0", fontSize: 42, fontWeight: 900, margin: 0, letterSpacing: 2 }}>AGENT ZERO</h1>
          <p style={{ color: "#555", fontSize: 16, marginTop: 12 }}>
            Enterprise FAANG-grade AI Agent System · Strategic Minds Advisory
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
            {["30 Capabilities","Manus-level+","Swarm Orchestration","ChatGPT Operator","GAIA Benchmark","Playwright Browser","n8n Templates","WhatsApp Parallel"].map(t=>(
              <span key={t} style={{ background: "#00d4a010", border: "1px solid #00d4a030", color: "#00d4a0", padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{t}</span>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {modules.map(m => (
            <Link key={m.href} href={m.href} style={{ textDecoration: "none" }}>
              <div style={{ background: "#0d1117", border: "1px solid #1e2a3a", borderRadius: 12, padding: 20, cursor: "pointer", transition: "border-color 0.2s", position: "relative" }}
                onMouseOver={e=>(e.currentTarget.style.borderColor="#00d4a040")}
                onMouseOut={e=>(e.currentTarget.style.borderColor="#1e2a3a")}>
                <span style={{ position: "absolute", top: 12, right: 12, background: "#00d4a020", color: "#00d4a0", fontSize: 9, padding: "2px 6px", borderRadius: 20, fontWeight: 700 }}>{m.badge}</span>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{m.icon}</div>
                <div style={{ fontWeight: 700, color: "#e0e0e0", marginBottom: 4 }}>{m.title}</div>
                <div style={{ color: "#555", fontSize: 12 }}>{m.desc}</div>
              </div>
            </Link>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 48, color: "#333", fontSize: 11 }}>
          Agent Zero v2.0 · Built for Strategic Minds Advisory / XPS Intelligence · {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}
