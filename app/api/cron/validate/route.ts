import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || new URL(req.url).searchParams.get("secret")
  if (auth && auth !== process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"
  const checks: Array<{ name: string; status: string; ms: number }> = []

  const endpoints = [
    { name: "ARIA chat", path: "/api/aria", method: "POST", body: { message: "health check", conversation_id: "cron" } },
    { name: "Audit system", path: "/api/audit", method: "POST", body: { system: "agent-zero" } },
    { name: "Schema valid", path: "/api/schema/validate", method: "GET", body: null },
    { name: "Metrics", path: "/api/metrics", method: "GET", body: null },
    { name: "Benchmark", path: "/api/benchmark", method: "GET", body: null },
  ]

  for (const ep of endpoints) {
    const start = Date.now()
    try {
      const r = await fetch(`${base}${ep.path}`, {
        method: ep.method,
        headers: { "Content-Type": "application/json" },
        body: ep.body ? JSON.stringify(ep.body) : undefined,
        signal: AbortSignal.timeout(10000),
      })
      checks.push({ name: ep.name, status: r.ok ? "ok" : `error_${r.status}`, ms: Date.now() - start })
    } catch (e) {
      checks.push({ name: ep.name, status: "timeout", ms: Date.now() - start })
    }
  }

  const all_ok = checks.every(c => c.status === "ok")
  const score = Math.round((checks.filter(c => c.status === "ok").length / checks.length) * 100)

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    status: all_ok ? "healthy" : "degraded",
    health_score: score,
    checks,
    version: "5.5.3",
    scaffold_ready: true,
  })
}
