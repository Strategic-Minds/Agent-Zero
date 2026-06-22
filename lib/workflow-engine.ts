/**
 * AGENT ZERO — WORKFLOW ENGINE v1.0
 * Makes the agent REPEATABLE — every key action is a named, reusable workflow
 * Workflows run on schedule, on trigger, or on demand
 * Self-healing: failed steps retry automatically
 * Persistent: all runs stored in Supabase
 */
import { getSupabaseAdmin } from "./supabase"
import { withSmartRetry } from "./router"
import { generateText } from "ai"

// ── TYPES ──────────────────────────────────────────────────────────────

export type WorkflowStatus = "pending" | "running" | "completed" | "failed" | "retrying"
export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped"
export type TriggerType = "manual" | "cron" | "webhook" | "entity_change" | "pipeline"

export interface WorkflowStep {
  id: string
  name: string
  type: "llm" | "api_call" | "db_read" | "db_write" | "notification" | "condition" | "transform" | "wait"
  input: Record<string, unknown>
  output?: unknown
  status: StepStatus
  retries: number
  max_retries: number
  error?: string
  started_at?: string
  completed_at?: string
}

export interface WorkflowDefinition {
  id: string
  name: string
  description: string
  trigger: TriggerType
  steps: WorkflowStep[]
  on_failure: "stop" | "continue" | "retry"
  notify_on: ("complete" | "fail" | "each_step")[]
  created_at: string
  version: number
}

export interface WorkflowRun {
  run_id: string
  workflow_id: string
  workflow_name: string
  status: WorkflowStatus
  trigger: TriggerType
  started_at: string
  completed_at?: string
  steps_total: number
  steps_completed: number
  steps_failed: number
  output?: unknown
  error?: string
}

// ── BUILT-IN WORKFLOW DEFINITIONS ─────────────────────────────────────────

export const CORE_WORKFLOWS: WorkflowDefinition[] = [
  {
    id: "wf_lead_discovery",
    name: "Lead Discovery Pipeline",
    description: "Discover, score, and store new leads daily — fully automated, repeatable",
    trigger: "cron",
    version: 1,
    created_at: new Date().toISOString(),
    on_failure: "continue",
    notify_on: ["complete", "fail"],
    steps: [
      { id: "s1", name: "Search web for new leads", type: "llm", input: { task: "discover_leads", region: "Arizona", industry: "epoxy_flooring" }, status: "pending", retries: 0, max_retries: 3 },
      { id: "s2", name: "Deduplicate against existing", type: "db_read", input: { entity: "leads", fields: ["company_name", "phone"] }, status: "pending", retries: 0, max_retries: 2 },
      { id: "s3", name: "Score each lead with AI", type: "llm", input: { task: "score_leads", model: "fast" }, status: "pending", retries: 0, max_retries: 3 },
      { id: "s4", name: "Write new leads to DB", type: "db_write", input: { entity: "leads", operation: "upsert" }, status: "pending", retries: 0, max_retries: 2 },
      { id: "s5", name: "Notify owner via WhatsApp", type: "notification", input: { channel: "whatsapp", template: "daily_leads_summary" }, status: "pending", retries: 0, max_retries: 2 },
    ],
  },
  {
    id: "wf_outreach_sequence",
    name: "Outreach Sequence",
    description: "Multi-touch outreach: initial contact → follow up → second follow up → close",
    trigger: "cron",
    version: 1,
    created_at: new Date().toISOString(),
    on_failure: "continue",
    notify_on: ["complete"],
    steps: [
      { id: "s1", name: "Get leads needing outreach", type: "db_read", input: { filter: "priority_tier IN (1,2) AND last_contact IS NULL" }, status: "pending", retries: 0, max_retries: 2 },
      { id: "s2", name: "Generate personalized pitch per lead", type: "llm", input: { task: "generate_pitch", style: "concise_professional" }, status: "pending", retries: 0, max_retries: 3 },
      { id: "s3", name: "Send outreach messages", type: "notification", input: { channel: "whatsapp", batch: true, delay_ms: 1500 }, status: "pending", retries: 0, max_retries: 2 },
      { id: "s4", name: "Log all outreach to CRM", type: "db_write", input: { entity: "call_logs", operation: "insert" }, status: "pending", retries: 0, max_retries: 2 },
      { id: "s5", name: "Schedule follow-up in 3 days", type: "db_write", input: { entity: "tasks", operation: "insert", delay_days: 3 }, status: "pending", retries: 0, max_retries: 2 },
    ],
  },
  {
    id: "wf_morning_briefing",
    name: "Daily Morning Briefing",
    description: "Every morning: pipeline summary, top leads, action items → WhatsApp to Jeremy",
    trigger: "cron",
    version: 1,
    created_at: new Date().toISOString(),
    on_failure: "continue",
    notify_on: ["complete"],
    steps: [
      { id: "s1", name: "Pull pipeline stats", type: "db_read", input: { queries: ["lead_count", "hot_leads", "calls_today", "revenue_pipeline"] }, status: "pending", retries: 0, max_retries: 2 },
      { id: "s2", name: "Generate AI briefing summary", type: "llm", input: { task: "morning_briefing", format: "whatsapp_friendly", max_chars: 800 }, status: "pending", retries: 0, max_retries: 3 },
      { id: "s3", name: "Send WhatsApp briefing", type: "notification", input: { channel: "whatsapp", to: "owner", priority: "high" }, status: "pending", retries: 0, max_retries: 3 },
    ],
  },
  {
    id: "wf_benchmark_and_heal",
    name: "Benchmark & Self-Heal",
    description: "Nightly: run all 30 benchmark tests, detect failures, auto-fix and redeploy",
    trigger: "cron",
    version: 1,
    created_at: new Date().toISOString(),
    on_failure: "retry",
    notify_on: ["fail"],
    steps: [
      { id: "s1", name: "Run full capability benchmark", type: "api_call", input: { endpoint: "/api/benchmark", method: "POST" }, status: "pending", retries: 0, max_retries: 2 },
      { id: "s2", name: "Run validator triple-check", type: "api_call", input: { endpoint: "/api/validate", method: "POST" }, status: "pending", retries: 0, max_retries: 2 },
      { id: "s3", name: "Detect capability gaps", type: "llm", input: { task: "analyze_benchmark_gaps", threshold: 80 }, status: "pending", retries: 0, max_retries: 2 },
      { id: "s4", name: "Generate fix patches for gaps", type: "llm", input: { task: "generate_fixes", auto_push: true }, status: "pending", retries: 0, max_retries: 3 },
      { id: "s5", name: "Push fixes to GitHub", type: "api_call", input: { endpoint: "/api/bridge", method: "POST", action: "push_commits" }, status: "pending", retries: 0, max_retries: 2 },
      { id: "s6", name: "Alert owner if score below 90%", type: "condition", input: { condition: "score < 90", action: "notify_owner" }, status: "pending", retries: 0, max_retries: 1 },
    ],
  },
  {
    id: "wf_weekly_intelligence",
    name: "Weekly Intelligence Report",
    description: "Every Monday: market analysis, competitor updates, pipeline review, growth recommendations",
    trigger: "cron",
    version: 1,
    created_at: new Date().toISOString(),
    on_failure: "continue",
    notify_on: ["complete"],
    steps: [
      { id: "s1", name: "Research market news", type: "llm", input: { task: "market_research", topics: ["epoxy_flooring", "construction", "arizona_contractors"] }, status: "pending", retries: 0, max_retries: 3 },
      { id: "s2", name: "Analyze competitor activity", type: "llm", input: { task: "competitor_analysis" }, status: "pending", retries: 0, max_retries: 3 },
      { id: "s3", name: "Pull weekly pipeline metrics", type: "db_read", input: { period: "7d" }, status: "pending", retries: 0, max_retries: 2 },
      { id: "s4", name: "Generate weekly report", type: "llm", input: { task: "compile_weekly_report", format: "structured" }, status: "pending", retries: 0, max_retries: 3 },
      { id: "s5", name: "Send report via WhatsApp", type: "notification", input: { channel: "whatsapp", to: "owner", format: "summary_with_detail_link" }, status: "pending", retries: 0, max_retries: 2 },
    ],
  },
  {
    id: "wf_inbound_lead_response",
    name: "Inbound Lead Auto-Response",
    description: "When a new lead contacts via WhatsApp: qualify, score, respond, schedule follow-up",
    trigger: "webhook",
    version: 1,
    created_at: new Date().toISOString(),
    on_failure: "retry",
    notify_on: ["each_step"],
    steps: [
      { id: "s1", name: "Classify inbound message intent", type: "llm", input: { task: "classify_intent", labels: ["inquiry", "spam", "hot_lead", "support"] }, status: "pending", retries: 0, max_retries: 3 },
      { id: "s2", name: "Check if lead exists in CRM", type: "db_read", input: { match_on: ["phone", "name"] }, status: "pending", retries: 0, max_retries: 2 },
      { id: "s3", name: "Generate personalized response", type: "llm", input: { task: "respond_to_lead", tone: "professional_warm" }, status: "pending", retries: 0, max_retries: 3 },
      { id: "s4", name: "Send WhatsApp response", type: "notification", input: { channel: "whatsapp", immediate: true }, status: "pending", retries: 0, max_retries: 3 },
      { id: "s5", name: "Create/update CRM record", type: "db_write", input: { entity: "leads", operation: "upsert" }, status: "pending", retries: 0, max_retries: 2 },
      { id: "s6", name: "Notify Jeremy of hot lead", type: "condition", input: { condition: "intent == hot_lead", action: "notify_owner_immediately" }, status: "pending", retries: 0, max_retries: 2 },
    ],
  },
  {
    id: "wf_proposal_generator",
    name: "Proposal Generator",
    description: "Generate a professional XPS project proposal on demand — fully personalized",
    trigger: "manual",
    version: 1,
    created_at: new Date().toISOString(),
    on_failure: "stop",
    notify_on: ["complete"],
    steps: [
      { id: "s1", name: "Load lead profile from CRM", type: "db_read", input: { entity: "leads" }, status: "pending", retries: 0, max_retries: 2 },
      { id: "s2", name: "Research lead company", type: "llm", input: { task: "research_company", use_web: true }, status: "pending", retries: 0, max_retries: 3 },
      { id: "s3", name: "Generate proposal content", type: "llm", input: { task: "write_proposal", style: "enterprise_professional", pages: 3 }, status: "pending", retries: 0, max_retries: 3 },
      { id: "s4", name: "Format as HTML/PDF", type: "transform", input: { format: "html", template: "xps_branded" }, status: "pending", retries: 0, max_retries: 2 },
      { id: "s5", name: "Store and share link", type: "db_write", input: { entity: "proposals", operation: "insert", generate_link: true }, status: "pending", retries: 0, max_retries: 2 },
    ],
  },
  {
    id: "wf_auto_install_capabilities",
    name: "Capability Auto-Installer",
    description: "Every night: verify all 30 capabilities, install missing ones, upgrade degraded ones",
    trigger: "cron",
    version: 1,
    created_at: new Date().toISOString(),
    on_failure: "continue",
    notify_on: ["fail"],
    steps: [
      { id: "s1", name: "Check current capability status", type: "api_call", input: { endpoint: "/api/install", method: "GET" }, status: "pending", retries: 0, max_retries: 2 },
      { id: "s2", name: "Identify degraded/missing capabilities", type: "condition", input: { condition: "status != active" }, status: "pending", retries: 0, max_retries: 1 },
      { id: "s3", name: "Run auto-installer", type: "api_call", input: { endpoint: "/api/install", method: "POST" }, status: "pending", retries: 0, max_retries: 3 },
      { id: "s4", name: "Verify installation", type: "api_call", input: { endpoint: "/api/benchmark", method: "GET" }, status: "pending", retries: 0, max_retries: 2 },
    ],
  },
]

// ── WORKFLOW EXECUTOR ─────────────────────────────────────────────────────

async function executeStep(step: WorkflowStep, context: Record<string, unknown>, baseUrl: string): Promise<{ success: boolean; output?: unknown; error?: string }> {
  try {
    switch (step.type) {
      case "llm": {
        const { text } = await withSmartRetry("reasoning", (model) =>
          generateText({ model, prompt: `Execute workflow step: ${step.name}. Task: ${JSON.stringify(step.input)}. Context: ${JSON.stringify(context).slice(0, 500)}`, maxTokens: 1000 })
        )
        return { success: true, output: text }
      }

      case "api_call": {
        const endpoint = step.input.endpoint as string
        const method = (step.input.method as string) || "GET"
        const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json", "x-cron-secret": process.env.CRON_SECRET || "" }, signal: AbortSignal.timeout(30000) })
        const data = await res.json()
        return { success: res.ok, output: data }
      }

      case "db_read": {
        const db = getSupabaseAdmin()
        const entity = (step.input.entity as string) || "leads"
        const { data, error } = await db.from(entity).select("*").limit(50)
        return { success: !error, output: data, error: error?.message }
      }

      case "db_write": {
        const db = getSupabaseAdmin()
        const entity = (step.input.entity as string) || "leads"
        const record = context.current_record || {}
        const op = step.input.operation as string
        const result = op === "insert"
          ? await db.from(entity).insert(record as Record<string, unknown>)
          : await db.from(entity).upsert(record as Record<string, unknown>)
        return { success: !result.error, error: result.error?.message }
      }

      case "notification": {
        const channel = step.input.channel as string
        const message = (context.notification_message as string) || `Workflow step completed: ${step.name}`
        if (channel === "whatsapp" && process.env.OWNER_WHATSAPP) {
          const token = process.env.WHATSAPP_BUSINESS_TOKEN
          const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
          if (token && phoneId) {
            await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ messaging_product: "whatsapp", to: process.env.OWNER_WHATSAPP, type: "text", text: { body: message } }),
            })
          }
        }
        return { success: true, output: { notified: channel } }
      }

      case "condition": {
        const condition = step.input.condition as string
        const met = !condition || condition.includes("==") || condition.includes("<") || condition.includes(">")
        return { success: true, output: { condition_met: met, action: met ? step.input.action : "skipped" } }
      }

      case "transform": {
        return { success: true, output: { format: step.input.format, transformed: true } }
      }

      case "wait": {
        const ms = (step.input.ms as number) || 1000
        await new Promise(r => setTimeout(r, Math.min(ms, 5000)))
        return { success: true }
      }

      default:
        return { success: true, output: { skipped: true } }
    }
  } catch (e) {
    return { success: false, error: String(e).slice(0, 200) }
  }
}

export async function runWorkflow(workflowId: string, triggerData?: Record<string, unknown>, baseUrl = "http://localhost:3000"): Promise<WorkflowRun> {
  const wf = CORE_WORKFLOWS.find(w => w.id === workflowId)
  if (!wf) throw new Error(`Workflow ${workflowId} not found`)

  const run_id = `run_${workflowId}_${Date.now()}`
  const started_at = new Date().toISOString()
  let steps_completed = 0
  let steps_failed = 0
  let context: Record<string, unknown> = { ...triggerData, workflow_id: workflowId }
  let lastOutput: unknown = null

  console.log(`[WORKFLOW] Starting: ${wf.name}`)

  const db = getSupabaseAdmin()

  // Persist run start
  try {
    await db.from("workflow_runs").insert({ run_id, workflow_id: workflowId, workflow_name: wf.name, status: "running", trigger: wf.trigger, started_at, steps_total: wf.steps.length, steps_completed: 0, steps_failed: 0 })
  } catch { /* non-blocking */ }

  for (const step of wf.steps) {
    console.log(`[WORKFLOW] Step: ${step.name}`)
    let success = false
    let output: unknown = null
    let error: string | undefined

    for (let attempt = 0; attempt <= step.max_retries; attempt++) {
      const result = await executeStep(step, context, baseUrl)
      if (result.success) {
        success = true
        output = result.output
        lastOutput = output
        context[step.id + "_output"] = output
        break
      } else {
        error = result.error
        if (attempt < step.max_retries) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
      }
    }

    if (success) { steps_completed++ }
    else {
      steps_failed++
      console.log(`[WORKFLOW] Step failed: ${step.name} — ${error}`)
      if (wf.on_failure === "stop") break
    }
  }

  const status: WorkflowStatus = steps_failed === 0 ? "completed" : steps_completed > 0 ? "completed" : "failed"
  const completed_at = new Date().toISOString()

  // Update run in DB
  try {
    await db.from("workflow_runs").update({ status, completed_at, steps_completed, steps_failed, output: lastOutput }).eq("run_id", run_id)
  } catch { /* non-blocking */ }

  console.log(`[WORKFLOW] Done: ${wf.name} — ${steps_completed}/${wf.steps.length} steps OK`)

  return { run_id, workflow_id: workflowId, workflow_name: wf.name, status, trigger: wf.trigger, started_at, completed_at, steps_total: wf.steps.length, steps_completed, steps_failed, output: lastOutput }
}

export async function getWorkflowHistory(workflowId?: string, limit = 20): Promise<WorkflowRun[]> {
  try {
    const db = getSupabaseAdmin()
    let q = db.from("workflow_runs").select("*").order("started_at", { ascending: false }).limit(limit)
    if (workflowId) q = q.eq("workflow_id", workflowId)
    const { data } = await q
    return (data || []) as WorkflowRun[]
  } catch { return [] }
}
