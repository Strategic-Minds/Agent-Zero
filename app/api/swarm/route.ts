import { NextResponse } from "next/server"
import { AGENTS } from "@/lib/orchestrator"

export const dynamic = "force-dynamic"
export const maxDuration = 120

interface SwarmTask {
  task: string
  agent_ids?: string[]
  timeout_ms?: number
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization")
  if (!auth?.includes(process.env.CRON_SECRET || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as SwarmTask
  const { task, agent_ids, timeout_ms = 30000 } = body

  if (!task) return NextResponse.json({ error: "task required" }, { status: 400 })

  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"
  const target_agents = agent_ids
    ? AGENTS.filter(a => agent_ids.includes(a.id))
    : AGENTS.filter(a => a.active).slice(0, 4) // max 4 parallel

  const start = Date.now()

  // Fan-out: all agents in parallel
  const results = await Promise.allSettled(
    target_agents.map(async (agent) => {
      const agent_start = Date.now()
      try {
        const r = await fetch(`${base}${agent.endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.CRON_SECRET}` },
          body: JSON.stringify({ message: task, task, agent_id: agent.id }),
          signal: AbortSignal.timeout(timeout_ms),
        })
        const data = r.ok ? await r.json().catch(() => ({})) : {}
        return { agent_id: agent.id, agent_name: agent.name, success: r.ok, latency_ms: Date.now() - agent_start, data }
      } catch (e) {
        return { agent_id: agent.id, agent_name: agent.name, success: false, latency_ms: Date.now() - agent_start, error: String(e) }
      }
    })
  )

  const resolved = results.map(r => r.status === "fulfilled" ? r.value : { success: false, error: "rejected" })
  const succeeded = resolved.filter(r => r.success).length

  return NextResponse.json({
    task, total_agents: target_agents.length, succeeded, failed: target_agents.length - succeeded,
    total_latency_ms: Date.now() - start,
    results: resolved,
    efficiency: `${Math.round((succeeded / target_agents.length) * 100)}%`,
  })
}
