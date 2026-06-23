/**
 * ORCHESTRATOR v3 — Circuit Breaker + True Parallel Fan-out
 * Fix 2: CircuitBreaker pattern prevents cascading failures
 * Fix 3: Promise.allSettled() fires multiple agents simultaneously
 */
import { getSupabaseAdmin } from "@/lib/supabase"

// ── Circuit Breaker ─────────────────────────────────────────────────────
type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN"

class CircuitBreaker {
  private state: CircuitState = "CLOSED"
  private failures = 0
  private lastFailure = 0
  private readonly threshold = 3
  private readonly resetMs = 30000

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailure > this.resetMs) {
        this.state = "HALF_OPEN"
      } else {
        throw new Error(`Circuit OPEN for ${Math.round((this.resetMs - (Date.now() - this.lastFailure)) / 1000)}s`)
      }
    }
    try {
      const result = await fn()
      if (this.state === "HALF_OPEN") { this.state = "CLOSED"; this.failures = 0 }
      return result
    } catch (e) {
      this.failures++
      this.lastFailure = Date.now()
      if (this.failures >= this.threshold) this.state = "OPEN"
      throw e
    }
  }

  getState() { return { state: this.state, failures: this.failures } }
  reset() { this.state = "CLOSED"; this.failures = 0 }
}

// One breaker per agent
const breakers: Record<string, CircuitBreaker> = {
  aria: new CircuitBreaker(),
  discovery: new CircuitBreaker(),
  intelligence: new CircuitBreaker(),
  outreach: new CircuitBreaker(),
  ghost: new CircuitBreaker(),
  apex: new CircuitBreaker(),
  reporter: new CircuitBreaker(),
}

// ── In-memory LRU cache ──────────────────────────────────────────────────
const CACHE = new Map<string, { value: unknown; expires: number }>()
export function cacheGet<T>(key: string): T | null {
  const entry = CACHE.get(key)
  if (!entry || Date.now() > entry.expires) { CACHE.delete(key); return null }
  return entry.value as T
}
export function cacheSet(key: string, value: unknown, ttlMs = 300000) {
  if (CACHE.size > 200) {
    const oldest = [...CACHE.entries()].sort((a, b) => a[1].expires - b[1].expires)[0]
    if (oldest) CACHE.delete(oldest[0])
  }
  CACHE.set(key, { value, expires: Date.now() + ttlMs })
}

// ── Agent registry ───────────────────────────────────────────────────────
export const AGENTS = [
  { id: "aria",        name: "ARIA",        role: "AI assistant + chat interface",              active: true,  endpoint: "/api/aria",        capabilities: ["chat","reason","analyze","summarize"] },
  { id: "discovery",   name: "DISCOVERY",   role: "Real web scraping — AZ contractors",         active: true,  endpoint: "/api/discovery",   capabilities: ["scrape","lead_gen","deduplicate"] },
  { id: "intelligence",name: "INTELLIGENCE",role: "AI lead scoring + profile generation",       active: true,  endpoint: "/api/intelligence",capabilities: ["score","profile","rank","pitch"] },
  { id: "outreach",    name: "OUTREACH",    role: "WhatsApp + email campaign automation",       active: true,  endpoint: "/api/outreach",    capabilities: ["send","schedule","personalize"] },
  { id: "ghost",       name: "GHOST",       role: "Shadow site cloner + competitor intel",      active: true,  endpoint: "/api/ghost",       capabilities: ["clone","scrape","competitive_analysis"] },
  { id: "apex",        name: "APEX",        role: "Autonomous code generation + self-healing",  active: true,  endpoint: "/api/apex",        capabilities: ["generate","heal","test","push_github"] },
  { id: "reporter",    name: "REPORTER",    role: "Daily briefing + email reports",             active: true,  endpoint: "/api/reporter",    capabilities: ["report","email","summarize"] },
  { id: "optimizer",   name: "OPTIMIZER",   role: "Gap-to-fix autonomous loop (hourly)",        active: true,  endpoint: "/api/cron/optimize",capabilities: ["audit","fix","heal","harden","evolve"] },
  { id: "validator",   name: "VALIDATOR",   role: "30-test headless validation suite",          active: true,  endpoint: "/api/validate",    capabilities: ["validate","score","triple_check"] },
  { id: "reflection",  name: "REFLECTION",  role: "Self-reflection + health scoring",           active: true,  endpoint: "/api/sop",         capabilities: ["reflect","health_score","trend"] },
]

export interface OrchResult {
  agent: string
  status: "fulfilled" | "rejected"
  value?: unknown
  error?: string
  duration_ms: number
  circuit_state: string
}

// ── TRUE PARALLEL FAN-OUT ────────────────────────────────────────────────
export async function orchestrateParallel(
  message: string,
  agents: string[] = ["aria", "intelligence"],
  context: Record<string, unknown> = {}
): Promise<{ results: OrchResult[]; duration_ms: number; agents_succeeded: number }> {
  const start = Date.now()

  // Fire all agents simultaneously — Promise.allSettled never rejects
  const promises = agents.map(async (agentId): Promise<OrchResult> => {
    const agentStart = Date.now()
    const breaker = breakers[agentId] || new CircuitBreaker()
    try {
      let value: unknown
      await breaker.execute(async () => {
        value = await routeToAgent(agentId, message, context)
      })
      return {
        agent: agentId,
        status: "fulfilled",
        value,
        duration_ms: Date.now() - agentStart,
        circuit_state: breaker.getState().state,
      }
    } catch (e) {
      return {
        agent: agentId,
        status: "rejected",
        error: String(e),
        duration_ms: Date.now() - agentStart,
        circuit_state: breaker.getState().state,
      }
    }
  })

  const settled = await Promise.allSettled(promises)
  const results = settled.map(r => r.status === "fulfilled" ? r.value : { agent: "unknown", status: "rejected" as const, error: "Promise failed", duration_ms: 0, circuit_state: "OPEN" })
  const succeeded = results.filter(r => r.status === "fulfilled").length

  return { results, duration_ms: Date.now() - start, agents_succeeded: succeeded }
}

async function routeToAgent(agentId: string, message: string, context: Record<string, unknown>): Promise<unknown> {
  const cacheKey = `${agentId}:${message.slice(0, 40)}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  let result: unknown

  if (agentId === "aria") {
    const { chat } = await import("@/agents/aria")
    result = await chat(message, [], String(context?.conversation_id || 'default'))
  } else if (agentId === "discovery") {
    const { runXPSDiscovery } = await import("@/agents/discovery")
    result = await runXPSDiscovery()
  } else if (agentId === "intelligence") {
    const { runIntelligence } = await import("@/agents/intelligence")
    result = await runIntelligence()
  } else if (agentId === "outreach") {
    const { runOutreach } = await import("@/agents/outreach")
    result = await runOutreach()
  } else if (agentId === "reporter") {
    const { compileReport } = await import("@/agents/reporter")
    result = await compileReport()
  } else if (agentId === "reflection") {
    const { reflect } = await import("@/agents/reflection")
    result = await reflect({ run_id: `orch_${Date.now()}`, run_type: "orchestrate", agents_fired: 1, agents_succeeded: 1, leads_discovered: 0 })
  } else {
    result = { agent: agentId, status: "routed", message }
  }

  cacheSet(cacheKey, result, 60000) // 1min cache
  return result
}

export function getBreakerStates() {
  return Object.fromEntries(Object.entries(breakers).map(([k, b]) => [k, b.getState()]))
}

export function resetBreaker(agentId: string) {
  if (breakers[agentId]) breakers[agentId].reset()
}

export async function logOrchestration(data: {
  run_id: string; agents: string[]; succeeded: number; duration_ms: number; message_preview: string
}) {
  try {
    const db = getSupabaseAdmin()
    await db.from("orchestration_logs" as any).upsert(data)
  } catch { /* non-fatal */ }
}

// ── Legacy exports for backward compatibility ────────────────────────────
export const SUB_AGENTS = AGENTS  // alias

export const OPENAI_ASSISTANT_INSTRUCTIONS = `You are ARIA, Agent Zero's primary AI interface for Xtreme Polishing Systems (XPS). You have access to 10 specialized sub-agents: Discovery (real web scraping), Intelligence (lead scoring), Outreach (WhatsApp/email), GHOST (competitor intel), APEX (code generation), Reporter (briefings), Optimizer (auto-fix), Validator (testing), Reflection (health scoring), and Evolution (self-improvement). You coordinate these agents to help Jeremy close more epoxy/concrete flooring deals across Arizona. Always provide actionable next steps. Current system version: 5.4.0.`

export const CHATGPT_FUNCTION_SCHEMA = {
  name: "route_to_agent",
  description: "Route a user request to the appropriate Agent Zero sub-agent",
  parameters: {
    type: "object",
    properties: {
      agent_id: {
        type: "string",
        enum: AGENTS.map(a => a.id),
        description: "The agent to route this request to",
      },
      message: {
        type: "string",
        description: "The message or task to pass to the agent",
      },
      priority: {
        type: "string",
        enum: ["high", "normal", "low"],
        description: "Priority of this request",
      },
    },
    required: ["agent_id", "message"],
  },
}

// Legacy: single-agent orchestrate wrapper
export async function orchestrate(
  message: string,
  preferredAgent = "aria",
  context: Record<string, unknown> = {}
) {
  return orchestrateParallel(message, [preferredAgent], context)
}
