/**
 * /api/chat — Vercel AI SDK Streaming Chat Endpoint
 * Compatible with useChat() React hook — powers the chat UI frontend
 */
import { createDataStreamResponse, streamText } from "ai"
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

const SYSTEM = `You are ARIA — Agent Zero intelligence interface for Strategic Minds Advisory. You have 20 tools. Use them to get real data and take real actions. Be direct and strategic. Always use tools for data questions.`

export async function POST(req: Request) {
  try {
    const { messages, model } = await req.json()
    if (model === "openai") _useOpenAI = true
    const selectedModel = _useOpenAI ? openai("gpt-4o-mini") : groq("llama-3.3-70b-versatile")

    const mem = await recallAll("agent-zero", { limit: 3 }).catch(() => [])
    const memCtx = mem.length > 0 ? "\nContext: " + mem.map((m: { key: string; value: unknown }) => `${m.key}: ${JSON.stringify(m.value)}`).join("; ") : ""

    return createDataStreamResponse({
      execute: async (dataStream) => {
        const trySend = (mdl: ReturnType<typeof groq | typeof openai>) => {
          const result = streamText({
            model: mdl, system: SYSTEM + memCtx, messages, tools: ALL_TOOLS, maxSteps: 8,
            onFinish: async ({ text, toolCalls }) => {
              await remember({ agent_id: "agent-zero", key: "aria_last_web", value: { response: text.slice(0, 300), tools: toolCalls?.map(t => t.toolName) }, memory_type: "episodic", importance: 3 }).catch(() => {})
            },
          })
          result.mergeIntoDataStream(dataStream)
          return result
        }
        try { trySend(selectedModel) }
        catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          if (msg.includes("rate limit") || msg.includes("quota") || msg.includes("429")) { _useOpenAI = true; trySend(openai("gpt-4o-mini")) }
          else throw e
        }
      },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
}
