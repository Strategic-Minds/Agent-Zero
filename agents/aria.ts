/**
 * ARIA v3.1 — Multi-channel sovereign intelligence agent
 * Channels: web | whatsapp | studio (freeform) | slack
 * Studio uses generateText (not generateObject) — no schema errors
 */
import { generateObject, generateText } from "ai"
import { createGroq } from "@ai-sdk/groq"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"
import { remember, recallAll, rehydrateSession } from "../lib/memory"
import { checkPermission } from "../lib/governance"

function getModel(large = false) {
  const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! })
  return large ? groq("llama-3.3-70b-versatile") : groq("llama-3.1-8b-instant")
}

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return openai("gpt-4o-mini")
}

async function withRetry<T>(fn: () => Promise<T>, label = "ARIA"): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try { return await fn() }
    catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if ((msg.includes("rate") || msg.includes("429") || msg.includes("quota") || msg.includes("limit")) && i < 2) {
        await new Promise(r => setTimeout(r, 3000 * (i + 1)))
        continue
      }
      throw e
    }
  }
  throw new Error(label + ": retries exhausted")
}

const STUDIO_SYSTEM = "You are Agent Zero Studio, an expert developer and designer. When asked to create websites, logos, UI components, or any visual output: generate complete production-ready HTML (wrapped in ```html) or SVG (wrapped in ```svg). Use stunning design with gradients and animations. Include all CSS inline. Make it immediately usable. Explain what you built before the code block."

const ARIA_SYSTEM = "You are ARIA, the sovereign intelligence agent for Strategic Minds Advisory. Work exclusively for Jeremy Bensen. Be strategic and results-focused. Refuse destructive actions without explicit confirmation. End significant responses with a specific next action."

export interface ARIAMessage { role: "user" | "assistant"; content: string }

export interface ARIAResponse {
  response: string
  toolsUsed: string[]
  memoryUpdated: boolean
  actionsTaken: string[]
  model: string
  latencyMs: number
}

export async function chat(
  message: string,
  history: ARIAMessage[] = [],
  sessionId = "default",
  channel = "web",
  systemOverride?: string
): Promise<ARIAResponse> {
  const start = Date.now()

  // STUDIO CHANNEL — freeform creative generation
  if (channel === "studio") {
    const system = systemOverride || STUDIO_SYSTEM
    let response = ""
    try {
      const { text } = await withRetry(() =>
        generateText({
          model: getModel(true),
          system,
          messages: [
            ...history.slice(-6).map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
            { role: "user" as const, content: message },
          ],
          maxTokens: 4000,
          temperature: 0.7,
        }), "Studio-Groq")
      response = text
    } catch {
      const oai = getOpenAI()
      if (oai) {
        try {
          const { text } = await withRetry(() =>
            generateText({ model: oai, system, messages: [{ role: "user" as const, content: message }], maxTokens: 4000 }), "Studio-OAI")
          response = text
        } catch { response = "Both Groq and OpenAI are rate-limited. Retry in 30 seconds." }
      } else {
        response = "Groq is rate-limited. Add OPENAI_API_KEY to Vercel env vars for fallback."
      }
    }
    return { response, toolsUsed: ["generate_text"], memoryUpdated: false, actionsTaken: ["creative"], model: "llama-3.3-70b-versatile", latencyMs: Date.now() - start }
  }

  // STANDARD CHANNEL — structured response
  try { await checkPermission("aria_chat", "aria", { channel }) } catch { /* non-blocking */ }

  const recentMem = await recallAll("aria", { limit: 3 }).catch(() => [])
  const memCtx = recentMem.length > 0
    ? "\nRecent context: " + (recentMem as Array<{ value?: { user?: string } }>).slice(0, 3).map(m => m?.value?.user || "").join(" | ")
    : ""

  const systemPrompt = (systemOverride || ARIA_SYSTEM) + memCtx

  try {
    const { object } = await withRetry(() =>
      generateObject({
        model: getModel(false),
        schema: z.object({
          response: z.string(),
          tools_used: z.array(z.string()).default([]),
          memory_updated: z.boolean().default(false),
          actions_taken: z.array(z.string()).default([]),
        }),
        system: systemPrompt,
        messages: [
          ...history.slice(-8).map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
          { role: "user" as const, content: message },
        ],
      }), "ARIA-structured")

    if (object.memory_updated) {
      await remember({
        agent_id: "aria",
        session_id: sessionId,
        memory_type: "episodic",
        key: "chat_" + Date.now(),
        value: { user: message.slice(0, 80), response: object.response.slice(0, 80) },
        importance: 3,
      }).catch(() => {})
    }

    return {
      response: object.response,
      toolsUsed: object.tools_used,
      memoryUpdated: object.memory_updated,
      actionsTaken: object.actions_taken,
      model: "llama-3.1-8b-instant",
      latencyMs: Date.now() - start,
    }
  } catch {
    // Final fallback
    try {
      const { text } = await withRetry(() =>
        generateText({ model: getModel(false), system: systemPrompt, prompt: message, maxTokens: 1500 }), "ARIA-fallback")
      return { response: text, toolsUsed: [], memoryUpdated: false, actionsTaken: ["fallback"], model: "fallback", latencyMs: Date.now() - start }
    } catch (e) {
      return { response: "ARIA temporarily unavailable: " + String(e).slice(0, 80), toolsUsed: [], memoryUpdated: false, actionsTaken: [], model: "error", latencyMs: Date.now() - start }
    }
  }
}
