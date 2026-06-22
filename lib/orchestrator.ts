/**
 * AGENT ZERO — PARALLEL MULTI-AGENT ORCHESTRATOR v1.0
 * Orchestrates ALL sub-agents in parallel using OpenAI Assistants API
 * Sub-agents: ARIA, Discovery, Intelligence, Outreach, GHOST, APEX, Validator, Benchmark
 * 
 * Architecture:
 *   Master Orchestrator (GPT-4o) → fans out tasks to N sub-agents in parallel
 *   Each sub-agent runs concurrently → results merged → synthesized response
 *   Compatible with ChatGPT custom GPTs via function-calling bridge
 */

// ── SUB-AGENT REGISTRY ────────────────────────────────────────────────

export interface SubAgent {
  id: string
  name: string
  role: string
  capabilities: string[]
  endpoint: string
  model: "gpt-4o" | "gpt-4o-mini" | "groq-llama-70b" | "groq-llama-8b"
  priority: number // 1=highest
  maxConcurrent: number
}

export const SUB_AGENTS: SubAgent[] = [
  {
    id: "aria",
    name: "ARIA",
    role: "Conversational intelligence, CRM queries, owner communication",
    capabilities: ["answer_questions", "query_crm", "send_whatsapp", "memory_recall", "briefing"],
    endpoint: "/api/aria",
    model: "groq-llama-8b",
    priority: 1,
    maxConcurrent: 3,
  },
  {
    id: "discovery",
    name: "Discovery Agent",
    role: "Lead discovery, web scraping, company research, registry queries",
    capabilities: ["find_leads", "scrape_web", "research_company", "registry_search"],
    endpoint: "/api/cron/lead-discovery",
    model: "gpt-4o-mini",
    priority: 2,
    maxConcurrent: 5,
  },
  {
    id: "intelligence",
    name: "Intelligence Agent",
    role: "Lead scoring, AI profiling, competitive analysis, market intelligence",
    capabilities: ["score_leads", "profile_company", "analyze_market", "rank_opportunities"],
    endpoint: "/api/cron/lead-scoring",
    model: "gpt-4o-mini",
    priority: 2,
    maxConcurrent: 5,
  },
  {
    id: "outreach",
    name: "Outreach Agent",
    role: "Personalized messaging, follow-up sequences, proposal generation",
    capabilities: ["write_pitch", "send_followup", "generate_proposal", "schedule_outreach"],
    endpoint: "/api/cron/outreach-followup",
    model: "gpt-4o",
    priority: 3,
    maxConcurrent: 3,
  },
  {
    id: "ghost",
    name: "GHOST Agent",
    role: "Headless web intelligence, competitor site cloning, deep research",
    capabilities: ["browse_web", "clone_site", "extract_data", "competitive_intel"],
    endpoint: "/api/ghost",
    model: "gpt-4o-mini",
    priority: 3,
    maxConcurrent: 3,
  },
  {
    id: "apex",
    name: "APEX Agent",
    role: "Autonomous coding, self-healing, code generation, GitHub operations",
    capabilities: ["write_code", "fix_bugs", "push_github", "deploy", "benchmark"],
    endpoint: "/api/apex",
    model: "gpt-4o",
    priority: 2,
    maxConcurrent: 2,
  },
  {
    id: "validator",
    name: "Validator Agent",
    role: "End-to-end testing, FAANG-grade validation, triple-check before URL release",
    capabilities: ["run_tests", "validate_deployment", "triple_check", "grade_system"],
    endpoint: "/api/validate",
    model: "gpt-4o-mini",
    priority: 1,
    maxConcurrent: 1,
  },
  {
    id: "benchmark",
    name: "Benchmark Agent",
    role: "Capability scoring, GAIA/SWE-bench testing, performance measurement",
    capabilities: ["run_benchmark", "score_capabilities", "track_improvement"],
    endpoint: "/api/benchmark",
    model: "gpt-4o-mini",
    priority: 3,
    maxConcurrent: 1,
  },
]

// ── TASK DECOMPOSITION ────────────────────────────────────────────────

export interface OrchestratorTask {
  id: string
  agent_id: string
  task: string
  input: Record<string, unknown>
  depends_on?: string[] // task IDs that must complete first
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

// ── TASK ROUTER — maps intent to sub-agents ───────────────────────────

export function routeTaskToAgents(masterTask: string): OrchestratorTask[] {
  const lower = masterTask.toLowerCase()
  const tasks: OrchestratorTask[] = []

  // ALWAYS include ARIA for coordination
  tasks.push({
    id: "t_aria",
    agent_id: "aria",
    task: masterTask,
    input: { message: masterTask, channel: "orchestrator" },
    priority: 1,
  })

  // Lead discovery tasks
  if (/lead|prospect|find|discover|search|company|contact/i.test(lower)) {
    tasks.push({ id: "t_disc", agent_id: "discovery", task: "Discover leads for: " + masterTask, input: { query: masterTask }, priority: 2 })
    tasks.push({ id: "t_intel", agent_id: "intelligence", task: "Score and profile leads", input: { query: masterTask }, depends_on: ["t_disc"], priority: 3 })
  }

  // Competitive/research tasks
  if (/research|competitor|market|analyze|intel/i.test(lower)) {
    tasks.push({ id: "t_ghost", agent_id: "ghost", task: "Deep web research: " + masterTask, input: { query: masterTask, depth: "full" }, priority: 2 })
    tasks.push({ id: "t_apex_intel", agent_id: "apex", task: "Analyze and report on: " + masterTask, input: { task: masterTask }, priority: 2 })
  }

  // Outreach/communication tasks
  if (/email|message|pitch|proposal|outreach|follow.?up|contact/i.test(lower)) {
    tasks.push({ id: "t_outreach", agent_id: "outreach", task: masterTask, input: { task: masterTask }, priority: 2 })
  }

  // Code/build tasks
  if (/build|code|create|generate|fix|deploy|debug|implement/i.test(lower)) {
    tasks.push({ id: "t_apex", agent_id: "apex", task: masterTask, input: { task: masterTask }, priority: 1 })
  }

  // Validation/testing
  if (/test|validate|check|verify|benchmark/i.test(lower)) {
    tasks.push({ id: "t_val", agent_id: "validator", task: masterTask, input: { task: masterTask }, priority: 1 })
    tasks.push({ id: "t_bench", agent_id: "benchmark", task: masterTask, input: { task: masterTask }, priority: 2 })
  }

  // Briefing/report
  if (/brief|report|summary|status|update|overview/i.test(lower)) {
    tasks.push({ id: "t_intel2", agent_id: "intelligence", task: "Generate report: " + masterTask, input: { task: masterTask }, priority: 2 })
  }

  return tasks
}

// ── PARALLEL EXECUTOR ─────────────────────────────────────────────────

async function executeAgentTask(task: OrchestratorTask, baseUrl: string): Promise<AgentResult> {
  const start = Date.now()
  const agent = SUB_AGENTS.find(a => a.id === task.agent_id)
  if (!agent) return { task_id: task.id, agent_id: task.agent_id, agent_name: task.agent_id, success: false, output: null, latency_ms: 0, error: "Agent not found" }

  try {
    const url = baseUrl + agent.endpoint

    // ARIA — always use chat endpoint
    if (task.agent_id === "aria") {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: task.task, channel: "orchestrator", session_id: "orch_" + Date.now() }),
        signal: AbortSignal.timeout(30000),
      })
      const data = await res.json() as { response?: string; error?: string }
      return { task_id: task.id, agent_id: task.agent_id, agent_name: agent.name, success: res.ok, output: data.response || data, latency_ms: Date.now() - start }
    }

    // All other agents — POST with task payload
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": process.env.CRON_SECRET || "" },
      body: JSON.stringify({ task: task.task, input: task.input }),
      signal: AbortSignal.timeout(60000),
    })

    let data: unknown
    try { data = await res.json() }
    catch { data = { raw: await res.text().catch(() => "no body") } }

    return { task_id: task.id, agent_id: task.agent_id, agent_name: agent.name, success: res.ok, output: data, latency_ms: Date.now() - start }
  } catch (e) {
    return { task_id: task.id, agent_id: task.agent_id, agent_name: agent.name, success: false, output: null, latency_ms: Date.now() - start, error: String(e).slice(0, 150) }
  }
}

// ── PARALLEL DEPENDENCY RESOLVER ─────────────────────────────────────

function groupByDependency(tasks: OrchestratorTask[]): OrchestratorTask[][] {
  const groups: OrchestratorTask[][] = []
  const completed = new Set<string>()
  let remaining = [...tasks]

  while (remaining.length > 0) {
    // Find tasks whose dependencies are all completed (or have none)
    const ready = remaining.filter(t => !t.depends_on || t.depends_on.every(d => completed.has(d)))
    if (ready.length === 0) break // circular or unresolvable — break to avoid infinite loop
    groups.push(ready)
    ready.forEach(t => completed.add(t.id))
    remaining = remaining.filter(t => !ready.includes(t))
  }

  return groups
}

// ── SYNTHESIS — merge results with GPT-4o ────────────────────────────

async function synthesizeResults(masterTask: string, results: AgentResult[]): Promise<string> {
  const successResults = results.filter(r => r.success)
  if (successResults.length === 0) return "All agents failed to respond. Please check system health."

  // Build context from all agent outputs
  const context = successResults.map(r => {
    const out = typeof r.output === "string" ? r.output : JSON.stringify(r.output).slice(0, 300)
    return `[${r.agent_name}]: ${out}`
  }).join("

")

  // Use OpenAI if available, otherwise use ARIA's output directly
  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + process.env.OPENAI_API_KEY },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are the Master Orchestrator for Agent Zero. Synthesize the outputs from multiple parallel sub-agents into one clear, actionable response for Jeremy Bensen. Be concise but comprehensive. Highlight the most important findings." },
            { role: "user", content: "Master task: " + masterTask + "

Sub-agent results:
" + context + "

Synthesize into one unified response:" },
          ],
          max_tokens: 1000,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(30000),
      })
      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
      return data.choices?.[0]?.message?.content || context.slice(0, 500)
    } catch { /* fall through */ }
  }

  // Fallback: use ARIA's response + summary
  const ariaResult = results.find(r => r.agent_id === "aria")
  const ariaOut = typeof ariaResult?.output === "string" ? ariaResult.output : ""
  const summary = `Agents involved: ${results.map(r => r.agent_name).join(", ")}

${ariaOut || context.slice(0, 600)}`
  return summary
}

// ── MAIN ORCHESTRATOR ─────────────────────────────────────────────────

export async function orchestrate(
  masterTask: string,
  options?: { agents?: string[]; baseUrl?: string; sessionId?: string }
): Promise<OrchestratorRun> {
  const run_id = "orch_" + Date.now()
  const start = Date.now()
  const baseUrl = options?.baseUrl || (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000")

  // 1. Route task to relevant agents
  let tasks = routeTaskToAgents(masterTask)

  // 2. Filter to requested agents if specified
  if (options?.agents && options.agents.length > 0) {
    tasks = tasks.filter(t => options.agents!.includes(t.agent_id))
  }

  // 3. Group by dependencies for parallel execution
  const groups = groupByDependency(tasks)
  const allResults: AgentResult[] = []

  // 4. Execute each group in PARALLEL, groups run sequentially
  for (const group of groups) {
    const groupResults = await Promise.all(
      group.map(task => executeAgentTask(task, baseUrl))
    )
    allResults.push(...groupResults)
  }

  // 5. Synthesize all results
  const synthesized = await synthesizeResults(masterTask, allResults)
  const successCount = allResults.filter(r => r.success).length

  return {
    run_id,
    master_task: masterTask,
    tasks,
    results: allResults,
    synthesized_response: synthesized,
    total_agents_used: allResults.length,
    parallel_groups: groups.length,
    total_latency_ms: Date.now() - start,
    status: successCount === 0 ? "failed" : successCount < allResults.length ? "partial" : "completed",
  }
}

// ── OPENAI CHATGPT BRIDGE — Function Calling Schema ───────────────────
// Use this in your ChatGPT Custom GPT Actions to call Agent Zero

export const CHATGPT_FUNCTION_SCHEMA = {
  name: "agent_zero_orchestrate",
  description: "Orchestrate Agent Zero's sub-agents (ARIA, Discovery, Intelligence, Outreach, GHOST, APEX) in parallel to complete complex tasks for XPS Intelligence / Strategic Minds Advisory",
  parameters: {
    type: "object",
    properties: {
      task: { type: "string", description: "The master task to delegate to Agent Zero's agent swarm" },
      agents: { type: "array", items: { type: "string", enum: ["aria", "discovery", "intelligence", "outreach", "ghost", "apex", "validator", "benchmark"] }, description: "Specific agents to use (optional — auto-routed if omitted)" },
      session_id: { type: "string", description: "Session ID for memory continuity" },
    },
    required: ["task"],
  },
}

export const OPENAI_ASSISTANT_INSTRUCTIONS = `You are Agent Zero — the master orchestrator for Strategic Minds Advisory / XPS Intelligence.

You coordinate a swarm of specialized AI agents:
- ARIA: conversational intelligence, CRM, WhatsApp
- Discovery: lead finding, web scraping
- Intelligence: lead scoring, profiling, market analysis
- Outreach: pitches, proposals, follow-up sequences
- GHOST: headless web research, competitor intelligence
- APEX: autonomous coding, GitHub operations, self-healing

When given a task, break it into parallel sub-tasks, fan them out to the right agents simultaneously, and synthesize the results into one clear action plan.

You serve Jeremy Bensen exclusively. You are proactive, strategic, and results-focused.
Always suggest the next action after completing a task.`
