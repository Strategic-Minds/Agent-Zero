import { NextResponse } from "next/server"
import { CORE_WORKFLOWS, runWorkflow, getWorkflowHistory } from "@/lib/workflow-engine"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const workflowId = searchParams.get("id")
  const history = searchParams.get("history")

  if (history) {
    const runs = await getWorkflowHistory(workflowId || undefined, 20)
    return NextResponse.json({ runs })
  }

  if (workflowId) {
    const wf = CORE_WORKFLOWS.find(w => w.id === workflowId)
    if (!wf) return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
    return NextResponse.json(wf)
  }

  return NextResponse.json({
    total: CORE_WORKFLOWS.length,
    workflows: CORE_WORKFLOWS.map(w => ({
      id: w.id, name: w.name, description: w.description,
      trigger: w.trigger, steps: w.steps.length, version: w.version,
    })),
  })
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret")
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { workflow_id?: string; trigger_data?: Record<string, unknown> }
  const { workflow_id, trigger_data } = body

  if (!workflow_id) return NextResponse.json({ error: "workflow_id required" }, { status: 400 })

  const baseUrl = process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000"
  const run = await runWorkflow(workflow_id, trigger_data, baseUrl)

  return NextResponse.json(run)
}
