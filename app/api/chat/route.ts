/**
 * /api/chat — Streaming Chat (Vercel AI SDK v4)
 * Compatible with useChat() React hook
 */
import { streamText } from "ai"
import { createGroq } from "@ai-sdk/groq"
import { createOpenAI } from "@ai-sdk/openai"
import { ALL_TOOLS } from "../../../lib/tools"
import { recallAll, remember } from "../../../lib/memory"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! })
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! })
let _useOpenAI = false

const SYSTEM = `You are ARIA — Agent Zero intelligence interface for Strategic Minds Advisory (XPS Intelligence).
You have 20 real tools. Use them to get real data. Be direct and strategic. No filler phrases.
Always use tools for data questions. Save important findings to memory.`

export async function POST(req: Request) {
  try {
    const { messages, model } = await req.json() as { messages: Array<{role: string; content: string}>; model?: string }
    if (model === "openai") _useOpenAI = true
    const selectedModel = _useOpenAI ? openai("gpt-4o-mini") : groq("llama-3.3-70b-versatile")

    const mem = await recallAll("agent-zero", { limit: 3 }).catch(() => [])
    const memCtx = mem.length > 0 ? "\nContext: " + mem.map((m: { key: string; value: unknown }) => `${m.key}: ${JSON.stringify(m.value)}`).join("; ") : ""

    const result = streamText({
      model: selectedModel,
      system: SYSTEM + memCtx,
      messages: messages as Parameters<typeof streamText>[0]["messages"],
      tools: ALL_TOOLS,
      maxSteps: 8,
      onFinish: async ({ text, toolCalls }) => {
        await remember({ agent_id: "agent-zero", key: "aria_last_web", value: { response: text.slice(0, 300), tools: toolCalls?.map(t => t.toolName) }, memory_type: "episodic", importance: 3 }).catch(() => {})
      },
    })

    return result.toDataStreamResponse()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("rate limit") || msg.includes("quota") || msg.includes("429")) {
      _useOpenAI = true
      const retry = streamText({ model: openai("gpt-4o-mini"), system: SYSTEM, messages: (await req.clone().json() as { messages: Parameters<typeof streamText>[0]["messages"] }).messages, tools: ALL_TOOLS, maxSteps: 8 })
      return retry.toDataStreamResponse()
    }
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
}
