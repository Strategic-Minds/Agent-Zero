/**
 * VERCEL AI GATEWAY — SMART MODEL ROUTER v2
 * Routes ALL LLM calls through Vercel AI Gateway
 * Benefits: unified auth, cost tracking, failover, caching, rate limit management
 * Gateway URL: https://ai-gateway.vercel.sh/v1
 */
import { createOpenAI } from "@ai-sdk/openai"
import { createGroq } from "@ai-sdk/groq"
import { createAnthropic } from "@ai-sdk/anthropic"

export type TaskType = "fast" | "reasoning" | "coding" | "vision" | "structured"

export interface ModelConfig {
  provider: "groq" | "openai" | "anthropic"
  model: string
  maxTokens: number
  costTier: "free" | "low" | "medium" | "high"
  label: string
}

// Smart routing table — cheapest/fastest first, fallback to powerful
const ROUTING_TABLE: Record<TaskType, ModelConfig[]> = {
  fast: [
    { provider: "groq", model: "llama-3.1-8b-instant", maxTokens: 8192, costTier: "free", label: "Groq fast" },
    { provider: "openai", model: "gpt-4o-mini", maxTokens: 16384, costTier: "low", label: "GPT-4o-mini" },
  ],
  reasoning: [
    { provider: "groq", model: "llama-3.3-70b-versatile", maxTokens: 32768, costTier: "free", label: "Groq 70B" },
    { provider: "openai", model: "gpt-4o", maxTokens: 128000, costTier: "medium", label: "GPT-4o" },
    { provider: "anthropic", model: "claude-3-5-sonnet-20241022", maxTokens: 200000, costTier: "medium", label: "Claude Sonnet" },
  ],
  coding: [
    { provider: "anthropic", model: "claude-3-5-sonnet-20241022", maxTokens: 200000, costTier: "medium", label: "Claude Sonnet" },
    { provider: "groq", model: "llama-3.3-70b-versatile", maxTokens: 32768, costTier: "free", label: "Groq 70B" },
    { provider: "openai", model: "gpt-4o", maxTokens: 128000, costTier: "medium", label: "GPT-4o" },
  ],
  vision: [
    { provider: "openai", model: "gpt-4o", maxTokens: 128000, costTier: "medium", label: "GPT-4o vision" },
    { provider: "anthropic", model: "claude-3-5-sonnet-20241022", maxTokens: 200000, costTier: "medium", label: "Claude vision" },
  ],
  structured: [
    { provider: "groq", model: "llama-3.1-8b-instant", maxTokens: 8192, costTier: "free", label: "Groq structured" },
    { provider: "openai", model: "gpt-4o-mini", maxTokens: 16384, costTier: "low", label: "GPT-4o-mini structured" },
  ],
}

// Circuit breaker — track failures per provider
const failures: Record<string, { count: number; ts: number }> = {}
const isOpen = (p: string) => {
  const f = failures[p]
  if (!f) return false
  if (f.count >= 3 && Date.now() - f.ts < 60000) return true
  if (Date.now() - f.ts > 60000) f.count = 0
  return false
}
const recordFail = (p: string) => {
  failures[p] = { count: (failures[p]?.count || 0) + 1, ts: Date.now() }
}

function buildModel(config: ModelConfig) {
  // Use Vercel AI Gateway when available
  const gatewayBase = process.env.VERCEL_AI_GATEWAY_URL
  // Format: https://ai-gateway.vercel.sh/v1/{teamId}/{slug}
  // Set VERCEL_AI_GATEWAY_URL=https://ai-gateway.vercel.sh/v1/YOUR_TEAM_ID/agent-zero

  switch (config.provider) {
    case "groq": {
      const client = createGroq({
        apiKey: process.env.GROQ_API_KEY,
        // Route through gateway if configured
        ...(gatewayBase ? { baseURL: `${gatewayBase}/groq` } : {}),
      })
      return client(config.model)
    }
    case "openai": {
      const client = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        ...(gatewayBase ? { baseURL: `${gatewayBase}/openai` } : {}),
      })
      return client(config.model)
    }
    case "anthropic": {
      const client = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        ...(gatewayBase ? { baseURL: `${gatewayBase}/anthropic` } : {}),
      })
      return client(config.model)
    }
  }
}

export function getModel(taskType: TaskType = "fast", forceProvider?: string) {
  const configs = ROUTING_TABLE[taskType]
  for (const config of configs) {
    if (forceProvider && config.provider !== forceProvider) continue
    if (isOpen(config.provider)) continue
    return {
      model: buildModel(config),
      config,
      recordFailure: () => recordFail(config.provider),
    }
  }
  // Final fallback — Groq always
  const fb = ROUTING_TABLE.fast[0]
  return { model: buildModel(fb), config: fb, recordFailure: () => recordFail(fb.provider) }
}

export async function withSmartRetry<T>(
  taskType: TaskType,
  fn: (model: ReturnType<typeof getModel>["model"]) => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastError: Error | null = null
  for (let i = 0; i < maxAttempts; i++) {
    const { model, config, recordFailure } = getModel(taskType)
    try {
      return await fn(model)
    } catch (e) {
      lastError = e as Error
      const msg = String(e)
      if (msg.includes("rate") || msg.includes("429") || msg.includes("quota") || msg.includes("limit")) {
        recordFailure()
        await new Promise(r => setTimeout(r, 2000 * (i + 1)))
        continue
      }
      throw e
    }
  }
  throw lastError || new Error("All providers exhausted")
}

export function detectTaskType(msg: string): TaskType {
  const m = msg.toLowerCase()
  if (/code|function|typescript|javascript|python|debug|fix|implement|class|api/.test(m)) return "coding"
  if (/analyz|reason|compar|strateg|plan|think|evaluat/.test(m)) return "reasoning"
  if (/image|screenshot|photo|visual|picture/.test(m)) return "vision"
  if (/json|schema|structur|format|object/.test(m)) return "structured"
  return "fast"
}
