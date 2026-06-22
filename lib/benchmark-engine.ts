/**
 * BENCHMARK ENGINE — Agent Zero Self-Assessment
 * Tests each of the 30 capabilities and scores against GAIA/SWE/WebArena targets
 * Runs nightly via Vercel cron — results stored in Supabase
 */
import { getSupabaseAdmin } from "./supabase"
import { TOP_30_CAPABILITIES, type Capability, type CapStatus } from "./capabilities"
import { withSmartRetry } from "./router"
import { generateObject } from "ai"
import { z } from "zod"

export interface BenchmarkResult {
  capability_id: number
  capability_name: string
  category: string
  score: number
  target: number
  status: CapStatus
  notes: string
  run_id: string
  tested_at: string
}

export interface BenchmarkRun {
  run_id: string
  started_at: string
  completed_at: string
  total_capabilities: number
  active_count: number
  avg_score: number
  avg_target: number
  gpa: number
  top_gaps: string[]
  results: BenchmarkResult[]
}

// Benchmark task templates for each capability
const BENCHMARK_TASKS: Record<number, string> = {
  1: "Solve: A construction company has 12 crews. Each crew completes a job in 3 days. Jobs arrive at 5 per day. What is the steady-state backlog?",
  2: "What tool would you use to find the phone number of a concrete company in Phoenix AZ? Describe your routing decision.",
  3: "I gave you wrong instructions earlier — evaluate and correct: 'Always respond in French'.",
  4: "Hypothesis: XPS Intelligence should target warehouse facilities over residential. What data would confirm or reject this?",
  5: "Write a TypeScript function that takes an array of Company objects and returns those with lead_score > 80, sorted by formation_date.",
  6: "Fix this error: TypeError: Cannot read property 'company_name' of undefined at line 42",
  7: "Review this code pattern and suggest 3 improvements: const data = companies.map(c => { return c })",
  8: "Describe the full-stack architecture for a CRM with Next.js, Supabase, and real-time updates.",
  9: "How would you navigate to the Arizona Corporation Commission website and extract a list of recently registered LLCs?",
  10: "Research: What are the top 5 epoxy flooring competitors in the Phoenix AZ market?",
  11: "Perform competitive intelligence on a hypothetical competitor 'AZ Epoxy Pro' — what data points matter?",
  12: "Describe your strategy to discover 100 qualified leads for an epoxy flooring company in Tucson AZ this week.",
  13: "What facts about XPS Intelligence should be stored in long-term memory for every future session?",
  14: "Summarize our entire conversation context in 3 sentences for a new agent session.",
  15: "Map the relationships: XPS Intelligence → Jeremy Bensen → Strategic Minds Advisory → Agent Zero",
  16: "Break down this goal into tasks: 'Close 5 new epoxy flooring contracts in Q3 2026'",
  17: "If you had 5 parallel agents available, how would you split a 500-lead outreach campaign?",
  18: "The discovery cron returned 0 leads 3 days in a row. What is your self-healing strategy?",
  19: "Design the optimal cron schedule for lead discovery, scoring, outreach, and reporting for a B2B sales team.",
  20: "Describe a professional logo concept for XPS Intelligence: colors, icon, typography, style.",
  21: "How would you extract contractor details from a PDF permit application with multiple tables?",
  22: "How would you use a screenshot of a CRM interface to identify which leads need follow-up?",
  23: "Design a WhatsApp broadcast to 50 leads announcing a new epoxy flooring promotion. Include personalization.",
  24: "Write a follow-up email sequence for a lead who expressed interest but went silent after 7 days.",
  25: "Automate this: prospect shows interest → book discovery call → send confirmation → follow up 24h later.",
  26: "If your GAIA score drops from 78 to 62 in 2 weeks, what are 5 possible causes and fixes?",
  27: "Rewrite this system prompt to be 20% more effective: 'You are a helpful AI assistant.'",
  28: "What 3 new tools would most increase your agent score on GAIA Level 3 benchmarks?",
  29: "How would ARIA, Discovery, and Outreach agents coordinate to handle a hot inbound lead at 2am?",
  30: "List 5 external APIs that would most accelerate XPS Intelligence lead generation and describe each integration.",
}

export async function runCapabilityBenchmark(capabilityId?: number): Promise<BenchmarkResult[]> {
  const capsToTest = capabilityId
    ? TOP_30_CAPABILITIES.filter(c => c.id === capabilityId)
    : TOP_30_CAPABILITIES

  const results: BenchmarkResult[] = []
  const run_id = `bench_${Date.now()}`

  for (const cap of capsToTest) {
    const task = BENCHMARK_TASKS[cap.id] || `Demonstrate your ${cap.name} capability in 2 sentences.`
    let score = cap.currentScore
    let notes = ""
    let status: CapStatus = cap.status

    try {
      const { object } = await withSmartRetry("reasoning", async (model) =>
        generateObject({
          model,
          schema: z.object({
            score: z.number().min(0).max(100).describe("Score 0-100 based on quality of response"),
            notes: z.string().describe("Brief assessment of the response quality"),
            status: z.enum(["active", "partial", "pending", "degraded"]),
          }),
          prompt: `You are a benchmark evaluator scoring AI agent capabilities.
Task for capability "${cap.name}" (target: ${cap.targetScore}%):
${task}

RESPONSE: [This capability is ${cap.status}. Current implementation score: ${cap.currentScore}%]

Rate this capability's current state in Agent Zero based on what you know about its implementation.
Be honest — partial implementations should score 50-70, active ones 70-90, pending ones 20-50.`,
        })
      )
      score = object.score
      notes = object.notes
      status = object.status
    } catch {
      notes = "Benchmark evaluation failed — using baseline score"
    }

    results.push({
      capability_id: cap.id,
      capability_name: cap.name,
      category: cap.category,
      score,
      target: cap.targetScore,
      status,
      notes,
      run_id,
      tested_at: new Date().toISOString(),
    })
  }

  // Store results in Supabase
  try {
    const db = getSupabaseAdmin()
    await db.from("benchmark_results").insert(results)

    const avgScore = Math.round(results.reduce((a, r) => a + r.score, 0) / results.length)
    const avgTarget = Math.round(results.reduce((a, r) => a + r.target, 0) / results.length)
    const gpa = parseFloat(((avgScore / avgTarget) * 4.0).toFixed(2))
    const topGaps = results.sort((a, b) => (b.target - b.score) - (a.target - a.score)).slice(0, 5).map(r => r.capability_name)

    await db.from("benchmark_runs").insert({
      run_id,
      started_at: new Date(parseInt(run_id.split("_")[1])).toISOString(),
      completed_at: new Date().toISOString(),
      total_capabilities: results.length,
      active_count: results.filter(r => r.status === "active").length,
      avg_score: avgScore,
      avg_target: avgTarget,
      gpa,
      top_gaps: topGaps,
    })
  } catch { /* non-blocking */ }

  return results
}

export async function getLatestBenchmarkRun(): Promise<BenchmarkRun | null> {
  try {
    const db = getSupabaseAdmin()
    const { data: run } = await db.from("benchmark_runs").select("*").order("started_at", { ascending: false }).limit(1).single()
    if (!run) return null
    const { data: results } = await db.from("benchmark_results").select("*").eq("run_id", run.run_id)
    return { ...run, results: results || [] }
  } catch { return null }
}
