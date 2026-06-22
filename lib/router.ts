/**
 * VERCEL AI GATEWAY — SMART MODEL ROUTER
 * Routes to cheapest/fastest model per task type
 * Fallback chain: Groq → OpenAI → Anthropic
 * Cost-aware: uses Groq free tier for low-stakes, GPT-4o for complex
 */
import { createOpenAI } from "@ai-sdk/openai"
import { createGroq } from "@ai-sdk/groq"
import { createAnthropic } from "@ai-sdk/anthropic"

export type TaskType = "fast" | "reasoning" | "coding" | "vision" | "embedding" | "structured"

export interface ModelConfig {
  provider: string
  model: string
  maxTokens: number
  costTier: "free" | "low" | "medium" | "high"
}

const ROUTING_TABLE: Record<TaskType, ModelConfig[]> = {
  fast: [
    { provider: "groq", model: "llama-3.1-8b-instant", maxTokens: 8192, costTier: "free" },
    { provider: "groq", model: "llama-3.3-70b-versatile", maxTokens: 32768, costTier: "free" },
    { provider: "openai", model: "gpt-4o-mini", maxTokens: 16384, costTier: "low" },
  ],
  reasoning: [
    { provider: "groq", model: "llama-3.3-70b-versatile", maxTokens: 32768, costTier: "free" },
    { provider: "openai", model: "gpt-4o", maxTokens: 128000, costTier: "medium" },
    { provider: "anthropic", model: "claude-3-5-sonnet-20241022", maxTokens: 200000, costTier: "medium" },
  ],
  coding: [
    { provider: "groq", model: "llama-3.3-70b-versatile", maxTokens: 32768, costTier: "free" },
    { provider: "anthropic", model: "claude-3-5-sonnet-20241022", maxTokens: 200000, costTier: "medium" },
    { provider: "openai", model: "gpt-4o", maxTokens: 128000, costTier: "medium" },
  ],
  vision: [
    { provider: "openai", model: "gpt-4o", maxTokens: 128000, costTier: "medium" },
    { provider: "anthropic", model: "claude-3-5-sonnet-20241022", maxTokens: 200000, costTier: "medium" },
  ],
  embedding: [
    { provider: "openai", model: "text-embedding-3-small", maxTokens: 8191, costTier: "low" },
  ],
  structured: [
    { provider: "groq", model: "llama-3.1-8b-instant", maxTokens: 8192, costTier: "free" },
    { provider: "openai", model: "gpt-4o-mini", maxTokens: 16384, costTier: "low" },
    { provider: "groq", model: "llama-3.3-70b-versatile", maxTokens: 32768, costTier: "free" },
  ],
}

// Track per-provider failures for circuit breaker
const providerFailures: Record<string, { count: number; lastFail: number }> = {}

function isCircuitOpen(provider: string): boolean {
  const f = providerFailures[provider]
  if (!f) return false
  if (f.count >= 3 && Date.now() - f.lastFail < 60000) return true
  if (Date.now() - f.lastFail > 60000) { f.count = 0 } // reset after 1 min
  return false
}

function recordFailure(provider: string) {
  providerFailures[provider] = {
    count: (providerFailures[provider]?.count || 0) + 1,
    lastFail: Date.now(),
  }
}

export function getModel(taskType: TaskType = "fast", forceProvider?: string) {
  const configs = ROUTING_TABLE[taskType]
  
  for (const config of configs) {
    if (forceProvider && config.provider !== forceProvider) continue
    if (isCircuitOpen(config.provider)) continue
    
    try {
      const model = buildModel(config)
      return { model, config, recordFailure: () => recordFailure(config.provider) }
    } catch { continue }
  }
  
  // Final fallback — always works if Groq key set
  const fallback = ROUTING_TABLE.fast[0]
  return { model: buildModel(fallback), config: fallback, recordFailure: () => recordFailure(fallback.provider) }
}

function buildModel(config: ModelConfig) {
  switch (config.provider) {
    case "groq": {
      const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
      return groq(config.model)
    }
    case "openai": {
      const oai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
      return oai(config.model)
    }
    case "anthropic": {
      const ant = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      return ant(config.model)
    }
    default:
      throw new Error(`Unknown provider: ${config.provider}`)
  }
}

export async function withSmartRetry<T>(
  taskType: TaskType,
  fn: (model: ReturnType<typeof getModel>["model"]) => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { model, config, recordFailure } = getModel(taskType)
    try {
      return await fn(model)
    } catch (e) {
      lastError = e as Error
      const msg = String(e)
      if (msg.includes("rate limit") || msg.includes("429") || msg.includes("quota") || msg.includes("exceeded")) {
        recordFailure()
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
        continue
      }
      throw e
    }
  }
  throw lastError || new Error("All model providers exhausted")
}

export function detectTaskType(message: string): TaskType {
  const m = message.toLowerCase()
  if (m.includes("code") || m.includes("function") || m.includes("typescript") || m.includes("javascript") || m.includes("python") || m.includes("debug") || m.includes("fix") || m.includes("implement")) return "coding"
  if (m.includes("analyze") || m.includes("reason") || m.includes("compare") || m.includes("strategy") || m.includes("plan") || m.includes("think")) return "reasoning"
  if (m.includes("image") || m.includes("screenshot") || m.includes("photo") || m.includes("visual")) return "vision"
  if (m.includes("json") || m.includes("schema") || m.includes("structured") || m.includes("format")) return "structured"
  return "fast"
}
