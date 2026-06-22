/**
 * AGENT ZERO — PARALLEL MULTI-AGENT ORCHESTRATOR v1.0
 * Fans tasks out to 8 sub-agents in parallel using Promise.all()
 * ChatGPT / OpenAI bridge included
 */

export interface SubAgent {
  id: string
  name: string
  role: string
  capabilities: string[]
  endpoint: string
  model: string
  priority: number
  maxConcurrent: number
}

export const SUB_AGENTS: SubAgent[] = [
  { id: "aria", name: "ARIA", role: "Conversational intelligence, CRM queries, owner communication", capabilities: ["answer_questions","query_crm","send_whatsapp","memory_recall"], endpoint: "/api/aria", model: "groq-llama-8b", priority: 1, maxConcurrent: 3 },
  { id: "discovery", name: "Discovery Agent", role: "Lead discovery, web scraping, company research", capabilities: ["find_leads","scrape_web","research_company"], endpoint: "/api/cron/lead-discovery", model: "gpt-4o-mini", priority: 2, maxConcurrent: 5 },
  { id: "intelligence", name: "Intelligence Agent", role: "Lead scoring, profiling, market intelligence", capabilities: ["score_leads","profile_company","analyze_market"], endpoint: "/api/cron/lead-scoring", model: "gpt-4o-mini", priority: 2, maxConcurrent: 5 },
  { id: "outreach", name: "Outreach Agent", role: "Personalized messaging, proposals, follow-ups", capabilities: ["write_pitch","send_followup","generate_proposal"], endpoint: "/api/cron/outreach-followup", model: "gpt-4o", priority: 3, maxConcurrent: 3 },
  { id: "ghost", name: "GHOST Agent", role: "Headless web intelligence, competitor site cloning", capabilities: ["browse_web","clone_site","extract_data","competitive_intel"], endpoint: "/api/ghost", model: "gpt-4o-mini", priority: 3, maxConcurrent: 3 },
  { id: "apex", name: "APEX Agent", role: "Autonomous coding, self-healing, GitHub operations", capabilities: ["write_code","fix_bugs","push_github","deploy"], endpoint: "/api/apex", model: "gpt-4o", priority: 2, maxConcurrent: 2 },
  { id: "validator", name: "Validator Agent", role: "End-to-end testing, FAANG validation, triple-check", capabilities: ["run_tests","validate_deployment","triple_check"], endpoint: "/api/validate", model: "gpt-4o-mini", priority: 1, maxConcurrent: 1 },
  { id: "benchmark", name: "Benchmark Agent", role: "Capability scoring, GAIA/SWE-bench testing", capabilities: ["run_benchmark","score_capabilities"], endpoint: "/api/benchmark", model: "gpt-4o-mini", priority: 3, maxConcurrent: 1 },
]

export interface OrchestratorTask {
  id: string
  agent_id: string
  task: string
  input: Record<string, unknown>
  depends_on?: string[]
  priority: number
}

export interface AgentResult {
  task_id: string
  agent_id: string
  agent_name: string
  success: boolean
  output: unknown
  latency_ms: number
  error?: string
}

export interface OrchestratorRun {
  run_id: string
  master_task: string
  tasks: OrchestratorTask[]
  results: AgentResult[]
  synthesized_response: string
  total_agents_used: number
  parallel_groups: number
  total_latency_ms: number
  status: "completed" | "partial" | "failed"
}

export function routeTaskToAgents(masterTask: string): OrchestratorTask[] {
  const lower = masterTask.toLowerCase()
  const tasks: OrchestratorTask[] = []
  tasks.push({ id: "t_aria", agent_id: "aria", task: masterTask, input: { message: masterTask, channel: "orchestrator" }, priority: 1 })
  if (/lead|prospect|find|discover|search|company|contact/i.test(lower)) {
    tasks.push({ id: "t_disc", agent_id: "discovery", task: "Discover leads for: " + masterTask, input: { query: masterTask }, priority: 2 })
    tasks.push({ id: "t_intel", agent_id: "intelligence", task: "Score leads", input: { query: masterTask }, depends_on: ["t_disc"], priority: 3 })
  }
  if (/research|competitor|market|analyze|intel/i.test(lower)) {
    tasks.push({ id: "t_ghost", agent_id: "ghost", task: "Research: " + masterTask, input: { query: masterTask }, priority: 2 })
    tasks.push({ id: "t_apex_intel", agent_id: "apex", task: "Analyze: " + masterTask, input: { task: masterTask }, priority: 2 })
  }
  if (/email|message|pitch|proposal|outreach|follow/i.test(lower)) {
    tasks.push({ id: "t_outreach", agent_id: "outreach", task: masterTask, input: { task: masterTask }, priority: 2 })
  }
  if (/build|code|create|generate|fix|deploy|debug/i.test(lower)) {
    tasks.push({ id: "t_apex", agent_id: "apex", task: masterTask, input: { task: masterTask }, priority: 1 })
  }
  if (/test|validate|check|verify|benchmark/i.test(lower)) {
    tasks.push({ id: "t_val", agent_id: "validator", task: masterTask, input: { task: masterTask }, priority: 1 })
    tasks.push({ id: "t_bench", agent_id: "benchmark", task: masterTask, input: { task: masterTask }, priority: 2 })
  }
  return tasks
}

function groupByDependency(tasks: OrchestratorTask[]): OrchestratorTask[][] {
  const groups: OrchestratorTask[][] = []
  const completed = new Set<string>()
  let remaining = [...tasks]
  while (remaining.length > 0) {
    const ready = remaining.filter(t => !t.depends_on || t.depends_on.every(d => completed.has(d)))
    if (ready.length === 0) break
    groups.push(ready)
    ready.forEach(t => completed.add(t.id))
    remaining = remaining.filter(t => !ready.includes(t))
  }
  return groups
}

async function executeAgentTask(task: OrchestratorTask, baseUrl: string): Promise<AgentResult> {
  const start = Date.now()
  const agent = SUB_AGENTS.find(a => a.id === task.agent_id)
  if (!agent) return { task_id: task.id, agent_id: task.agent_id, agent_name: task.agent_id, success: false, output: null, latency_ms: 0, error: "Agent not found" }
  try {
    const url = baseUrl + agent.endpoint
    const isARIA = task.agent_id === "aria"
    const body = isARIA
      ? JSON.stringify({ message: task.task, channel: "orchestrator", session_id: "orch_" + Date.now() })
      : JSON.stringify({ task: task.task, input: task.input })
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (!isARIA) headers["x-cron-secret"] = process.env.CRON_SECRET || ""
    const res = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(45000) })
    let data: unknown
    try { data = await res.json() } catch { data = { raw: "no body" } }
    const output = isARIA ? (data as Record<string,unknown>).response || data : data
    return { task_id: task.id, agent_id: task.agent_id, agent_name: agent.name, success: res.ok, output, latency_ms: Date.now() - start }
  } catch (e) {
    return { task_id: task.id, agent_id: task.agent_id, agent_name: agent.name, success: false, output: null, latency_ms: Date.now() - start, error: String(e).slice(0, 150) }
  }
}

async function synthesizeResults(masterTask: string, results: AgentResult[]): Promise<string> {
  const successResults = results.filter(r => r.success)
  if (successResults.length === 0) return "All agents failed to respond. Please check system health."
  const SEP = " | "
  const context = successResults.map(r => {
    const out = typeof r.output === "string" ? r.output : JSON.stringify(r.output).slice(0, 300)
    return "[" + r.agent_name + "]: " + out
  }).join(SEP)
  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + process.env.OPENAI_API_KEY },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are the Master Orchestrator for Agent Zero. Synthesize sub-agent outputs into one clear actionable response for Jeremy Bensen. Be concise but comprehensive." },
            { role: "user", content: "Task: " + masterTask + " | Results: " + context.slice(0, 2000) },
          ],
          max_tokens: 800,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(30000),
      })
      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
      return data.choices?.[0]?.message?.content || context.slice(0, 600)
    } catch { /* fall through */ }
  }
  const ariaResult = results.find(r => r.agent_id === "aria")
  const ariaOut = typeof ariaResult?.output === "string" ? ariaResult.output : ""
  return "Agents: " + results.map(r => r.agent_name).join(", ") + " | " + (ariaOut || context.slice(0, 500))
}

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
  const groups = groupByDependency(tasks)
  const allResults: AgentResult[] = []
  for (const group of groups) {
    const groupResults = await Promise.all(group.map(task => executeAgentTask(task, baseUrl)))
    allResults.push(...groupResults)
  }
  const synthesized = await synthesizeResults(masterTask, allResults)
  const successCount = allResults.filter(r => r.success).length
  return {
    run_id, master_task: masterTask, tasks, results: allResults,
    synthesized_response: synthesized,
    total_agents_used: allResults.length,
    parallel_groups: groups.length,
    total_latency_ms: Date.now() - start,
    status: successCount === 0 ? "failed" : successCount < allResults.length ? "partial" : "completed",
  }
}

export const CHATGPT_FUNCTION_SCHEMA = {
  name: "agent_zero_orchestrate",
  description: "Orchestrate Agent Zero sub-agents (ARIA, Discovery, Intelligence, Outreach, GHOST, APEX) in parallel for XPS Intelligence",
  parameters: {
    type: "object",
    properties: {
      task: { type: "string", description: "The master task to delegate to Agent Zero" },
      agents: { type: "array", items: { type: "string", enum: ["aria","discovery","intelligence","outreach","ghost","apex","validator","benchmark"] }, description: "Specific agents to use — optional, auto-routed if omitted" },
      session_id: { type: "string", description: "Session ID for memory continuity" },
    },
    required: ["task"],
  },
}

export const OPENAI_ASSISTANT_INSTRUCTIONS = "You are Agent Zero, the master orchestrator for Strategic Minds Advisory / XPS Intelligence. You coordinate 8 specialized AI agents: ARIA (conversational, CRM), Discovery (lead finding), Intelligence (scoring), Outreach (pitches/proposals), GHOST (web research), APEX (coding/GitHub), Validator (testing), Benchmark (scoring). Fan tasks out to agents in parallel. Serve Jeremy Bensen exclusively. Be proactive and strategic."
