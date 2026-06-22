/**
 * AGENT ZERO — PARALLEL MULTI-AGENT ORCHESTRATOR v2.0
 * True fan-out: ALL agents fire simultaneously via Promise.all()
 * 8 sub-agents: ARIA, Discovery, Intelligence, Outreach, GHOST, APEX, Validator, Benchmark
 * Each agent call is a separate async fetch — no sequential blocking
 */

export interface SubAgent {
  id: string; name: string; role: string
  capabilities: string[]; endpoint: string
  model: string; priority: number; maxConcurrent: number
}

export const SUB_AGENTS: SubAgent[] = [
  { id: "aria",         name: "ARIA",             role: "Conversational intelligence, CRM, owner comms",     capabilities: ["chat","crm","brief","memory"],                    endpoint: "/api/aria",         model: "llama-3.1-8b-instant", priority: 0, maxConcurrent: 5 },
  { id: "discovery",   name: "Discovery",         role: "Real lead scraping — Google Maps, Yelp, AZ Registry", capabilities: ["scrape","leads","search","web"],                 endpoint: "/api/discovery",    model: "llama-3.1-8b-instant", priority: 1, maxConcurrent: 3 },
  { id: "intelligence",name: "Intelligence",      role: "Lead scoring, profiling, market analysis",           capabilities: ["score","analyze","rank","profile"],               endpoint: "/api/intelligence",  model: "llama-3.1-70b-versatile", priority: 1, maxConcurrent: 3 },
  { id: "outreach",    name: "Outreach",          role: "Personalized messaging, proposals, sequences",       capabilities: ["email","whatsapp","pitch","proposal"],            endpoint: "/api/outreach",     model: "llama-3.1-70b-versatile", priority: 2, maxConcurrent: 3 },
  { id: "ghost",       name: "GHOST",             role: "Full site clone, shadow tech, competitor intel",      capabilities: ["clone","scrape","screenshot","pdf","shadow"],    endpoint: "/api/ghost",        model: "llama-3.1-70b-versatile", priority: 1, maxConcurrent: 2 },
  { id: "apex",        name: "APEX",              role: "Autonomous coding, self-healing, GitHub ops",        capabilities: ["code","deploy","fix","build","push"],             endpoint: "/api/apex",         model: "llama-3.3-70b-versatile", priority: 1, maxConcurrent: 2 },
  { id: "validator",   name: "Validator",         role: "End-to-end validation, FAANG testing",              capabilities: ["test","validate","benchmark","audit"],            endpoint: "/api/validate",     model: "llama-3.1-8b-instant", priority: 2, maxConcurrent: 2 },
  { id: "benchmark",   name: "Benchmark",         role: "Capability scoring, performance analysis",          capabilities: ["benchmark","score","analyze","compare"],          endpoint: "/api/benchmark",    model: "llama-3.1-8b-instant", priority: 2, maxConcurrent: 2 },
]

export interface OrchestratorTask {
  id: string; agent_id: string; task: string
  input: Record<string, unknown>; priority: number
}

export interface AgentResult {
  agent_id: string; agent_name: string; task: string
  success: boolean; response: unknown
  latency_ms: number; error?: string
}

export interface OrchestratorRun {
  run_id: string; master_task: string
  tasks: OrchestratorTask[]; results: AgentResult[]
  synthesized_response: string
  total_agents_used: number; parallel_groups: number
  total_latency_ms: number; status: string
}

// ── TASK ROUTER ────────────────────────────────────────────────────────────
export function routeTaskToAgents(masterTask: string): OrchestratorTask[] {
  const lower = masterTask.toLowerCase()
  const tasks: OrchestratorTask[] = []

  // ARIA always fires
  tasks.push({ id: "t_aria", agent_id: "aria", task: masterTask, input: { message: masterTask, channel: "orchestrator" }, priority: 0 })

  // Intelligence always fires — context + scoring
  tasks.push({ id: "t_intel", agent_id: "intelligence", task: "Analyze: " + masterTask, input: { query: masterTask }, priority: 1 })

  // Discovery for lead/search/business tasks
  if (/lead|prospect|find|discover|search|company|contact|status|check|report|brief|morning|scrape/i.test(lower)) {
    tasks.push({ id: "t_disc", agent_id: "discovery", task: "Discover: " + masterTask, input: { query: masterTask }, priority: 1 })
  }

  // GHOST for clone/research/competitor
  if (/clone|shadow|copy|competitor|research|market|site|website|scrape|mirror/i.test(lower)) {
    tasks.push({ id: "t_ghost", agent_id: "ghost", task: "Shadow: " + masterTask, input: { query: masterTask }, priority: 1 })
  }

  // Outreach for comms tasks
  if (/email|message|pitch|proposal|outreach|follow|send|whatsapp/i.test(lower)) {
    tasks.push({ id: "t_outreach", agent_id: "outreach", task: masterTask, input: { task: masterTask }, priority: 1 })
  }

  // APEX for code/build tasks
  if (/build|code|create|generate|fix|deploy|debug|implement|write/i.test(lower)) {
    tasks.push({ id: "t_apex", agent_id: "apex", task: masterTask, input: { task: masterTask }, priority: 1 })
  }

  // Validator + Benchmark for test/audit tasks
  if (/test|validate|check|verify|benchmark|audit|score/i.test(lower)) {
    tasks.push({ id: "t_val", agent_id: "validator", task: masterTask, input: { task: masterTask }, priority: 1 })
    tasks.push({ id: "t_bench", agent_id: "benchmark", task: masterTask, input: { task: masterTask }, priority: 2 })
  }

  // Guarantee minimum 2 agents always (proves parallel execution)
  if (tasks.length < 2) {
    tasks.push({ id: "t_bench_default", agent_id: "benchmark", task: "System status: " + masterTask, input: { task: masterTask }, priority: 1 })
  }

  return tasks
}

// ── AGENT EXECUTOR ─────────────────────────────────────────────────────────
async function executeAgentTask(task: OrchestratorTask, baseUrl: string): Promise<AgentResult> {
  const agent = SUB_AGENTS.find(a => a.id === task.agent_id)
  const start = Date.now()
  try {
    const res = await fetch(baseUrl + (agent?.endpoint || "/api/aria"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-chatgpt-action": "true" },
      body: JSON.stringify(task.input),
      signal: AbortSignal.timeout(25000),
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    return {
      agent_id: task.agent_id,
      agent_name: agent?.name || task.agent_id,
      task: task.task,
      success: res.ok,
      response: data,
      latency_ms: Date.now() - start,
    }
  } catch (e) {
    return {
      agent_id: task.agent_id,
      agent_name: agent?.name || task.agent_id,
      task: task.task,
      success: false,
      response: null,
      latency_ms: Date.now() - start,
      error: String(e),
    }
  }
}

// ── SYNTHESIZER ────────────────────────────────────────────────────────────
function synthesizeResults(masterTask: string, results: AgentResult[]): string {
  const successful = results.filter(r => r.success)
  if (successful.length === 0) return "All agents failed to respond. Check system health."

  const parts: string[] = []
  for (const r of successful) {
    const data = r.response as Record<string, unknown>
    const text = data?.response || data?.synthesized_response || data?.result || data?.message || data?.status
    if (text && typeof text === "string" && text.length > 10) {
      parts.push(`[${r.agent_name}]: ${text.slice(0, 200)}`)
    }
  }
  if (parts.length === 0) return `${successful.length}/${results.length} agents responded. Task: ${masterTask}`
  return parts.join(" | ")
}

// ── MAIN ORCHESTRATOR — TRUE PARALLEL FAN-OUT ──────────────────────────────
export async function orchestrate(
  masterTask: string,
  options?: { agents?: string[]; baseUrl?: string; sessionId?: string }
): Promise<OrchestratorRun> {
  const run_id = "orch_" + Date.now()
  const start = Date.now()
  const baseUrl = options?.baseUrl || (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000")

  let tasks = routeTaskToAgents(masterTask)
  if (options?.agents && options.agents.length > 0) {
    tasks = tasks.filter(t => options.agents!.includes(t.agent_id))
  }

  // TRUE PARALLEL: all agents fire simultaneously
  const allResults = await Promise.all(tasks.map(task => executeAgentTask(task, baseUrl)))

  const synthesized = synthesizeResults(masterTask, allResults)
  const successCount = allResults.filter(r => r.success).length

  return {
    run_id,
    master_task: masterTask,
    tasks,
    results: allResults,
    synthesized_response: synthesized,
    total_agents_used: allResults.length,
    parallel_groups: 1,
    total_latency_ms: Date.now() - start,
    status: successCount === 0 ? "failed" : successCount < allResults.length ? "partial" : "completed",
  }
}

export const CHATGPT_FUNCTION_SCHEMA = {
  name: "agent_zero_orchestrate",
  description: "Orchestrate Agent Zero sub-agents in parallel (ARIA, Discovery, Intelligence, Outreach, GHOST, APEX, Validator, Benchmark)",
  parameters: {
    type: "object",
    properties: {
      task: { type: "string" },
      agents: { type: "array", items: { type: "string", enum: ["aria","discovery","intelligence","outreach","ghost","apex","validator","benchmark"] } },
      session_id: { type: "string" },
    },
    required: ["task"],
  },
}
