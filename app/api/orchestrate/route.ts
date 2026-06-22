import { NextResponse } from "next/server"
import { orchestrate, SUB_AGENTS, CHATGPT_FUNCTION_SCHEMA, OPENAI_ASSISTANT_INSTRUCTIONS } from "@/lib/orchestrator"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET() {
  return NextResponse.json({
    status: "Agent Zero Orchestrator — online",
    agents: SUB_AGENTS.map(a => ({ id: a.id, name: a.name, role: a.role, capabilities: a.capabilities })),
    chatgpt_function_schema: CHATGPT_FUNCTION_SCHEMA,
    openai_assistant_instructions: OPENAI_ASSISTANT_INSTRUCTIONS,
    usage: "POST with { task, agents?, session_id? }",
  })
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret")

  // Allow unauthenticated reads for ChatGPT integration discovery
  // But require auth for actual orchestration
  if (!auth && req.method === "POST") {
    const isPublicEndpoint = req.headers.get("x-chatgpt-action") === "true"
    if (!isPublicEndpoint && auth !== process.env.CRON_SECRET && auth !== "Bearer " + process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const body = await req.json().catch(() => ({})) as {
    task?: string
    agents?: string[]
    session_id?: string
  }

  if (!body.task) return NextResponse.json({ error: "task required" }, { status: 400 })

  const baseUrl = process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000"
  const result = await orchestrate(body.task, {
    agents: body.agents,
    baseUrl,
    sessionId: body.session_id,
  })

  return NextResponse.json({
    run_id: result.run_id,
    status: result.status,
    synthesized_response: result.synthesized_response,
    agents_used: result.results.map(r => ({
      agent: r.agent_name,
      success: r.success,
      latency_ms: r.latency_ms,
    })),
    parallel_groups: result.parallel_groups,
    total_latency_ms: result.total_latency_ms,
  })
}
