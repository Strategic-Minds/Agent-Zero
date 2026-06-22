import Link from "next/link"
export const dynamic = "force-dynamic"

export default function Home() {
  return (
    <div style={{ background: "#000", minHeight: "100vh", color: "#fff", fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>⬡</div>
      <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: 1, margin: "0 0 12px" }}>Agent Zero</h1>
      <p style={{ color: "#555", fontSize: 16, marginBottom: 40, maxWidth: 500 }}>Enterprise AI · Build websites, logos, dashboards, and systems — instantly</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/studio" style={{ background: "#fff", color: "#000", padding: "12px 28px", borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
          ▶ Open Studio
        </Link>
        <Link href="/chat" style={{ background: "#111", color: "#fff", border: "1px solid #222", padding: "12px 28px", borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
          💬 ARIA Chat
        </Link>
        <Link href="/dashboard" style={{ background: "#111", color: "#fff", border: "1px solid #222", padding: "12px 28px", borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
          📊 Dashboard
        </Link>
      </div>
      <div style={{ marginTop: 60, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, maxWidth: 600, width: "100%" }}>
        {[["🌐", "Websites"], ["🎨", "Logos & SVG"], ["📊", "Dashboards"], ["⚡", "Components"], ["🏗️", "Full Apps"], ["🎯", "CRM Systems"]].map(([icon, label]) => (
          <div key={label as string} style={{ background: "#0a0a0a", border: "1px solid #111", borderRadius: 10, padding: "16px 12px" }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
            <div style={{ color: "#555", fontSize: 12 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
