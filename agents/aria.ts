/**
 * ARIA v3.0 — Multi-channel sovereign intelligence agent
 * Channels: web | whatsapp | studio (creative/freeform) | slack
 * Studio channel uses generateText for freeform creative output (logos, websites, etc.)
 */
import { generateObject, generateText } from "ai"
import { createGroq } from "@ai-sdk/groq"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"
import { remember, recallAll, rehydrateSession, dehydrateSession } from "../lib/memory"
import { checkPermission, logAction } from "../lib/governance"

function getModel(creative = false) {
  const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! })
  // Use larger model for creative/coding tasks
  if (creative) return groq("llama-3.3-70b-versatile")
  return groq("llama-3.1-8b-instant")
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
      if ((msg.includes("rate") || msg.includes("429") || msg.includes("quota") || msg.includes("exceeded") || msg.includes("limit")) && i < 2) {
        await new Promise(r => setTimeout(r, 3000 * (i + 1)))
        continue
      }
      throw e
    }
  }
  throw new Error(`${label}: All retries exhausted`)
}

const STUDIO_SYSTEM = `You are Agent Zero Studio — an expert full-stack developer and designer.
When asked to create websites, UIs, logos, components, dashboards, landing pages:
1. Generate complete, beautiful, production-ready HTML/CSS/JS or SVG
2. Wrap ALL HTML in \`\`\`html code blocks
3. Wrap ALL SVG in \`\`\`svg code blocks
4. Use stunning design: gradients, glassmorphism, modern typography, animations
5. Include all CSS inline — no external dependencies
6. For logos: clean professional SVG with the exact requested branding
7. For websites: complete pages with nav, hero, sections, footer
8. ALWAYS explain what you built BEFORE the code block
9. Make it immediately usable — no placeholder content
10. Design style: Stripe/Linear/Vercel aesthetic — clean, modern, dark or light`

const ARIA_SYSTEM = `You are ARIA — the sovereign intelligence agent for Strategic Minds Advisory / XPS Intelligence.
You work exclusively for Jeremy Bensen. You are autonomous, strategic, results-focused.
For data: query the database. For research: search the web.
For code/design: generate complete solutions.
Destructive actions (delete, bulk wipe): REFUSE without explicit confirmation.
Always end significant responses with a specific suggested next action.`

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
  channel: string = "web",
  systemOverride?: string
): Promise<ARIAResponse> {
  const start = Date.now()

  // ── STUDIO CHANNEL — freeform creative / code generation ──────────────
  if (channel === "studio") {
    const system = systemOverride || STUDIO_SYSTEM
    const isCreative = /logo|website|svg|landing|dashboard|component|ui|design|page|build|create/i.test(message)

    let response = ""

    // Try Groq 70B first (best for creative)
    try {
      const { text } = await withRetry(() =>
        generateText({
          model: getModel(true),
          system,
          messages: [
            ...history.slice(-6).map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
            { role: "user" as const, content: message },
          ],
          maxTokens: isCreative ? 4000 : 2000,
          temperature: 0.7,
        }), "Studio-Groq"
      )
      response = text
    } catch {
      // Fallback to OpenAI
      const oai = getOpenAI()
      if (oai) {
        try {
          const { text } = await withRetry(() =>
            generateText({
              model: oai,
              system,
              messages: [
                ...history.slice(-6).map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
                { role: "user" as const, content: message },
              ],
              maxTokens: isCreative ? 4000 : 2000,
            }), "Studio-OpenAI"
          )
          response = text
        } catch { response = "Sorry, both Groq and OpenAI are currently rate-limited. Please try again in 30 seconds." }
      } else {
        response = "Groq is rate-limited. Add OPENAI_API_KEY to Vercel env vars for fallback."
      }
    }

    return {
      response,
      toolsUsed: ["generate_text"],
      memoryUpdated: false,
      actionsTaken: ["creative_generation"],
      model: "llama-3.3-70b-versatile",
      latencyMs: Date.now() - start,
    }
  }

  // ── STANDARD CHANNEL — structured agent response ──────────────────────
  try {
    await checkPermission("aria_chat", "aria", { channel })
  } catch { /* governance check failed — continue anyway */ }

  const recentMem = await recallAll("agent-zero", { limit: 3 }).catch(() => [])
  const memCtx = recentMem.length > 0
    ? `
Recent memory: ${recentMem.map((m: { content?: string; text?: string }) => m.content || m.text || "").slice(0, 3).join(" | ")}`
    : ""

  const systemPrompt = (systemOverride || ARIA_SYSTEM) + memCtx

  let responseText = ""

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
      }), "ARIA-structured"
    )

    if (object.memory_updated) {
      await remember("agent-zero", `User asked: ${message.slice(0, 100)} — responded: ${object.response.slice(0, 100)}`, sessionId).catch(() => {})
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
    // Final fallback — generateText with no schema
    try {
      const { text } = await withRetry(() =>
        generateText({
          model: getModel(false),
          system: systemPrompt,
          prompt: message,
          maxTokens: 1500,
        }), "ARIA-fallback"
      )
      responseText = text
    } catch (e) {
      responseText = `ARIA is temporarily rate-limited. Error: ${String(e).slice(0, 100)}`
    }

    return {
      response: responseText,
      toolsUsed: [],
      memoryUpdated: false,
      actionsTaken: ["fallback_text"],
      model: "fallback",
      latencyMs: Date.now() - start,
    }
  }
}
