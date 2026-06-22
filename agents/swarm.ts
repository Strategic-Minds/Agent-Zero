/**
 * SWARM ORCHESTRATOR — Enterprise Multi-Agent Parallel Execution
 * Exceeds Manus concurrent tasks (20+)
 * Fan-out architecture: 1 task → N parallel agents → merge results
 */
import { remember, recallAll } from "@/lib/memory"
import { logAction } from "@/lib/governance"
import { getSupabaseAdmin } from "@/lib/supabase"

export interface SwarmTask {
  id: string
  agent: "ARIA" | "APEX" | "GHOST" | "DISCOVERY" | "OUTREACH" | "INTELLIGENCE" | "BROWSER"
  instruction: string
  priority: 1 | 2 | 3 | 4 | 5
  depends_on?: string[]
  timeout_ms?: number
}

export interface SwarmResult {
  task_id: string
  agent: string
  status: "completed" | "failed" | "timeout"
  result: unknown
  duration_ms: number
  error?: string
}

export interface SwarmJob {
  job_id: string
  tasks: SwarmTask[]
  strategy: "parallel" | "sequential" | "priority_queue"
  created_at: string
}

const AGENT_ENDPOINTS: Record<string, string> = {
  ARIA: "/api/aria",
  APEX: "/api/apex",
  GHOST: "/api/ghost",
  DISCOVERY: "/api/cron/lead-discovery",
  OUTREACH: "/api/cron/outreach-followup",
  INTELLIGENCE: "/api/cron/lead-scoring",
}

const BASE = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

async function executeAgentTask(task: SwarmTask): Promise<SwarmResult> {
  const start = Date.now()
  const endpoint = AGENT_ENDPOINTS[task.agent] || "/api/aria"
  const secret = process.env.BRIDGE_SECRET || ""
  
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), task.timeout_ms || 60000)
    
    const res = await fetch(`${BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secret}`,
      },
      body: JSON.stringify({ message: task.instruction, channel: "swarm", task_id: task.id }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    
    const data = await res.json() as Record<string, unknown>
    return {
      task_id: task.id,
      agent: task.agent,
      status: "completed",
      result: data,
      duration_ms: Date.now() - start,
    }
  } catch (e) {
    return {
      task_id: task.id,
      agent: task.agent,
      status: String(e).includes("abort") ? "timeout" : "failed",
      result: null,
      duration_ms: Date.now() - start,
      error: String(e).slice(0, 200),
    }
  }
}

export async function executeSwarm(job: SwarmJob): Promise<{
  job_id: string
  results: SwarmResult[]
  summary: string
  total_duration_ms: number
  success_rate: number
}> {
  const start = Date.now()
  const results: SwarmResult[] = []
  
  await logAction({ agent_id: "swarm", action: "swarm_start", level: 1, status: "allowed", details: { job_id: job.job_id, task_count: job.tasks.length, strategy: job.strategy } })

  if (job.strategy === "parallel") {
    // Execute all tasks simultaneously
    const promises = job.tasks.map(t => executeAgentTask(t))
    const settled = await Promise.allSettled(promises)
    for (const s of settled) {
      if (s.status === "fulfilled") results.push(s.value)
      else results.push({ task_id: "unknown", agent: "unknown", status: "failed", result: null, duration_ms: 0, error: String(s.reason) })
    }
  } else if (job.strategy === "priority_queue") {
    // Sort by priority then execute in batches of 3
    const sorted = [...job.tasks].sort((a, b) => b.priority - a.priority)
    const batchSize = 3
    for (let i = 0; i < sorted.length; i += batchSize) {
      const batch = sorted.slice(i, i + batchSize)
      const batchResults = await Promise.allSettled(batch.map(t => executeAgentTask(t)))
      for (const s of batchResults) {
        if (s.status === "fulfilled") results.push(s.value)
      }
    }
  } else {
    // Sequential
    for (const task of job.tasks) {
      results.push(await executeAgentTask(task))
    }
  }

  const completed = results.filter(r => r.status === "completed").length
  const successRate = Math.round((completed / results.length) * 100)
  const totalDuration = Date.now() - start
  
  // Save job to DB
  try {
    const db = getSupabaseAdmin()
    await db.from("swarm_jobs").upsert({
      job_id: job.job_id,
      task_count: job.tasks.length,
      completed,
      success_rate: successRate,
      strategy: job.strategy,
      duration_ms: totalDuration,
      results: results,
      created_at: new Date().toISOString(),
    }, { onConflict: "job_id" })
  } catch { /* non-blocking */ }

  await remember({ agent_id: "agent-zero", key: `swarm_${job.job_id}`, value: { successRate, completed, total: results.length }, memory_type: "episodic", importance: 6 }).catch(() => {})

  return {
    job_id: job.job_id,
    results,
    summary: `${completed}/${results.length} tasks completed (${successRate}%) in ${(totalDuration/1000).toFixed(1)}s`,
    total_duration_ms: totalDuration,
    success_rate: successRate,
  }
}

// Pre-built swarm templates
export const SWARM_TEMPLATES = {
  daily_intelligence: {
    strategy: "parallel" as const,
    tasks: [
      { id: "t1", agent: "DISCOVERY" as const, instruction: "Run lead discovery Arizona epoxy flooring", priority: 5 as const, timeout_ms: 60000 },
      { id: "t2", agent: "INTELLIGENCE" as const, instruction: "Score all unscored leads", priority: 4 as const, timeout_ms: 60000 },
      { id: "t3", agent: "ARIA" as const, instruction: "Use system_status tool and generate daily health report", priority: 3 as const, timeout_ms: 30000 },
    ],
  },
  lead_blitz: {
    strategy: "priority_queue" as const,
    tasks: [
      { id: "t1", agent: "DISCOVERY" as const, instruction: "Discover 20 new leads Phoenix AZ flooring", priority: 5 as const, timeout_ms: 90000 },
      { id: "t2", agent: "INTELLIGENCE" as const, instruction: "Score and rank all leads by revenue potential", priority: 5 as const, timeout_ms: 60000 },
      { id: "t3", agent: "OUTREACH" as const, instruction: "Generate personalized outreach for top 5 leads", priority: 4 as const, timeout_ms: 60000 },
      { id: "t4", agent: "ARIA" as const, instruction: "Use generate_report type=leads format=whatsapp and report summary", priority: 3 as const, timeout_ms: 30000 },
    ],
  },
}
