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

  // ARIA always runs first — handles any task
  tasks.push({ id: "t_aria", agent_id: "aria", task: masterTask, input: { message: masterTask, channel: "orchestrator" }, priority: 0 })

  // Intelligence agent always runs — provides context scoring
  tasks.push({ id: "t_intel", agent_id: "intelligence", task: "Analyze and assess: " + masterTask, input: { query: masterTask }, priority: 1 })

  // Discovery agent runs for lead/business/search tasks OR generic system queries
  if (/lead|prospect|find|discover|search|company|contact|status|check|brief|report|morning/i.test(lower)) {
    tasks.push({ id: "t_disc", agent_id: "discovery", task: "Discover relevant data for: " + masterTask, input: { query: masterTask }, priority: 1 })
  }

  // Research/competitive intel
  if (/research|competitor|market|analyze|intel|landscape/i.test(lower)) {
    tasks.push({ id: "t_ghost", agent_id: "ghost", task: "Research: " + masterTask, input: { query: masterTask }, priority: 1 })
    tasks.push({ id: "t_apex_intel", agent_id: "apex", task: "Analyze: " + masterTask, input: { task: masterTask }, priority: 2 })
  }

  // Outreach tasks
  if (/email|message|pitch|proposal|outreach|follow|send/i.test(lower)) {
    tasks.push({ id: "t_outreach", agent_id: "outreach", task: masterTask, input: { task: masterTask }, priority: 1 })
  }

  // Build/code tasks
  if (/build|code|create|generate|fix|deploy|debug|implement/i.test(lower)) {
    tasks.push({ id: "t_apex", agent_id: "apex", task: masterTask, input: { task: masterTask }, priority: 1 })
  }

  // Validation tasks
  if (/test|validate|check|verify|benchmark|audit/i.test(lower)) {
    tasks.push({ id: "t_val", agent_id: "validator", task: masterTask, input: { task: masterTask }, priority: 1 })
    tasks.push({ id: "t_bench", agent_id: "benchmark", task: masterTask, input: { task: masterTask }, priority: 2 })
  }

  // Ensure minimum 2 agents always run for parallel execution proof
  if (tasks.length < 2) {
    tasks.push({ id: "t_bench_default", agent_id: "benchmark", task: "System status for: " + masterTask, input: { task: masterTask }, priority: 1 })
  }

  return tasks
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
