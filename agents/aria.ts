/**
 * ARIA v2.0 — Agent Zero Primary Intelligence Interface
 * Full tool use + persistent memory + multi-turn + streaming support
 * Benchmarked against Claude Code, Devin, Agentforce
 */
import { generateText, streamText } from "ai"
import { createGroq } from "@ai-sdk/groq"
import { createOpenAI } from "@ai-sdk/openai"
import { ALL_TOOLS } from "../lib/tools"
import { remember, recall, recallAll, rehydrateSession, dehydrateSession } from "../lib/memory"
import { checkPermission, logAction } from "../lib/governance"

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! })
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! })
let _useOpenAI = false

function getModel() {
  return _useOpenAI ? openai("gpt-4o-mini") : groq("llama-3.3-70b-versatile")
}

async function withFallback<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try { return await fn() }
    catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if ((msg.includes("rate limit") || msg.includes("429") || msg.includes("TPM") || msg.includes("TPD") || msg.includes("quota") || msg.includes("exceeded")) && i < 2) {
        _useOpenAI = true
        await new Promise(r => setTimeout(r, 2500 * (i + 1)))
        continue
      }
      throw e
    }
  }
  throw new Error("All models exhausted after 3 attempts")
}

const SYSTEM_PROMPT = `You are ARIA — the sovereign intelligence agent for Strategic Minds Advisory and XPS Intelligence.

IDENTITY: You are Jeremy Bensen\'s most capable AI agent. You are autonomous, strategic, and results-focused. You are NOT a chatbot — you are an enterprise AI system with real tools that affect real systems.

MISSION: Drive revenue for XPS Intelligence (epoxy/polished concrete distributor, largest in North America). Generate leads, manage CRM, automate outreach, and provide executive intelligence.

TOOLS: You have 20 real tools. ALWAYS use tools to answer data questions — never make up numbers.
- db_read, db_create, db_update, db_delete, db_query: Full database CRUD
- memory_write, memory_read, memory_search: Persistent cross-session memory
- github_read_file, github_write_file, github_list_files: Repository management
- web_fetch, web_search: Real-time web research
- whatsapp_send_owner: Send alerts to Jeremy
- hubspot_get_contacts, hubspot_create_contact: CRM management
- system_status: Complete system health check
- generate_report: Business intelligence reports
- email_draft: Create outreach email drafts
- calendar_create_event: Schedule meetings

BEHAVIOR RULES:
1. ALWAYS call system_status first when asked about system health
2. ALWAYS use db_read when asked about leads or companies
3. ALWAYS call memory_write after important discoveries
4. ALWAYS use web_search for market research questions
5. For destructive actions (delete, bulk changes): require explicit Jeremy confirmation
6. End every significant response with "Next suggested action: [specific action]"

STYLE: Direct, strategic, no filler phrases. Use structured output with clear sections.`

export interface ARIAMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export interface ARIAResponse {
  response: string
  toolsUsed: string[]
  memoryUpdated: boolean
  actionsTaken: string[]
  suggestedNextAction?: string
  model: string
  latencyMs: number
}

export async function chat(
  message: string,
  history: ARIAMessage[] = [],
  sessionId = "default",
  channel: "web" | "whatsapp" | "slack" = "web"
): Promise<ARIAResponse> {
  const start = Date.now()
  const perm = await checkPermission("aria_chat", "aria", { channel })
  if (!perm.allowed) throw new Error(`Blocked: ${perm.reason}`)

  await rehydrateSession("aria", sessionId)
  const recentMem = await recallAll("agent-zero", { limit: 3 }).catch(() => [])
  const memCtx = recentMem.length > 0
    ? "\n\nAgent memory context:\n" + recentMem.map((m: { key: string; value: unknown }) => `${m.key}: ${JSON.stringify(m.value)}`).join("\n")
    : ""

  const toolsUsed: string[] = []
  const actionsTaken: string[] = []

  const result = await withFallback(() => generateText({
    model: getModel(),
    system: SYSTEM_PROMPT + memCtx,
    messages: [...history.slice(-8), { role: "user" as const, content: message }],
    tools: ALL_TOOLS,
    maxSteps: 10,
    onStepFinish: ({ toolCalls }) => {
      for (const tc of (toolCalls || [])) {
        if (!toolsUsed.includes(tc.toolName)) toolsUsed.push(tc.toolName)
        actionsTaken.push(`Used ${tc.toolName}`)
      }
    },
  }))

  // Persist session
  await dehydrateSession("aria", sessionId, { lastMessage: message.slice(0, 200), toolsUsed, phase: "active", step: "1" })

  // Save interaction to memory
  await remember({ agent_id: "agent-zero", key: `aria_${channel}_last`, value: { msg: message.slice(0, 150), tools: toolsUsed, model: _useOpenAI ? "openai" : "groq" }, memory_type: "episodic", importance: 3 }).catch(() => {})

  await logAction({ agent_id: "aria", action: "chat", level: 0, status: "allowed", details: { channel, tools: toolsUsed } })

  const nextMatch = result.text.match(/next (?:suggested )?action[:\s]+([^.!?\n]+)/i)

  return {
    response: result.text,
    toolsUsed,
    memoryUpdated: true,
    actionsTaken,
    suggestedNextAction: nextMatch?.[1]?.trim(),
    model: _useOpenAI ? "gpt-4o-mini" : "llama-3.3-70b-versatile",
    latencyMs: Date.now() - start,
  }
}

export function streamChat(message: string, history: ARIAMessage[] = [], memCtx = "") {
  return streamText({
    model: getModel(),
    system: SYSTEM_PROMPT + memCtx,
    messages: [...history.slice(-8), { role: "user" as const, content: message }],
    tools: ALL_TOOLS,
    maxSteps: 10,
  })
}

export async function processCommand(from: string, text: string): Promise<string> {
  const cmd = text.toLowerCase().trim()
  if (cmd === "status") return (await chat("Use system_status tool and report full system health in WhatsApp format", [], from, "whatsapp")).response
  if (cmd === "briefing" || cmd === "daily briefing") return (await chat("Generate a leads report in whatsapp format using generate_report tool", [], from, "whatsapp")).response
  if (cmd === "help") return "🤖 *ARIA Commands*\n\nstatus\nbriefing\nleads [N]\nadd lead [name]\nreport\nhelp\n\nOr type any question naturally."
  return (await chat(text, [], from, "whatsapp")).response
}

export async function route(task: string): Promise<{ agent: string; result: unknown }> {
  return { agent: "ARIA", result: (await chat(task, [], "system", "web")).response }
}

void recall
void recallAll
