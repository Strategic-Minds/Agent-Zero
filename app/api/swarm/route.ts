/**
 * /api/swarm — Parallel Multi-Agent Orchestration Endpoint
 */
import { NextRequest, NextResponse } from "next/server"
import { executeSwarm, SWARM_TEMPLATES } from "@/agents/swarm"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")
  const secret = process.env.BRIDGE_SECRET || ""
  if (!auth?.includes(secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json() as {
      template?: keyof typeof SWARM_TEMPLATES
      tasks?: Array<{ id: string; agent: string; instruction: string; priority: number }>
      strategy?: "parallel" | "sequential" | "priority_queue"
    }

    let tasks
    let strategy: "parallel" | "sequential" | "priority_queue" = "parallel"

    if (body.template && SWARM_TEMPLATES[body.template]) {
      const tmpl = SWARM_TEMPLATES[body.template]
      tasks = tmpl.tasks
      strategy = tmpl.strategy
    } else if (body.tasks) {
      tasks = body.tasks
      strategy = body.strategy || "parallel"
    } else {
      return NextResponse.json({ error: "Provide template or tasks array" }, { status: 400 })
    }

    const job = {
      job_id: `swarm_${Date.now()}`,
      tasks: tasks as Parameters<typeof executeSwarm>[0]["tasks"],
      strategy,
      created_at: new Date().toISOString(),
    }

    const result = await executeSwarm(job)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0,300) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: "operational",
    endpoint: "/api/swarm",
    templates: ["daily_intelligence", "lead_blitz"],
    usage: { method: "POST", body: { template: "daily_intelligence" } },
  })
}
