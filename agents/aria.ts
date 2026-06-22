/**
 * ARIA v2.0 — Full tool use via manual tool execution loop (ai@3.x compatible)
 */
import { generateObject } from "ai"
import { createGroq } from "@ai-sdk/groq"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"
import { ALL_TOOLS, AgentTool } from "../lib/tools"
import { remember, recallAll, rehydrateSession, dehydrateSession } from "../lib/memory"
import { checkPermission, logAction } from "../lib/governance"

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! })
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! })
let _useOpenAI = false

function getModel() { return _useOpenAI ? openai("gpt-4o-mini") : groq("llama-3.3-70b-versatile") }

async function withFallback<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try { return await fn() }
    catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if ((msg.includes("rate limit") || msg.includes("429") || msg.includes("TPM") || msg.includes("TPD") || msg.includes("quota") || msg.includes("exceeded")) && i < 2) {
        _useOpenAI = true; await new Promise(r => setTimeout(r, 2500 * (i + 1))); continue
      }
      throw e
    }
  }
  throw new Error("All models exhausted")
}

const TOOL_NAMES = Object.keys(ALL_TOOLS)

const ARIA_PROMPT = `You are ARIA — the sovereign intelligence agent for Strategic Minds Advisory and XPS Intelligence.

IDENTITY: You work exclusively for Jeremy Bensen. You are autonomous, strategic, results-focused. NOT a chatbot — an enterprise AI with real tools.

MISSION: Drive revenue for XPS Intelligence (epoxy/polished concrete, largest in North America). Generate leads, manage CRM, automate outreach, provide executive intelligence.

AVAILABLE TOOLS: ${TOOL_NAMES.join(", ")}

TOOL USAGE RULES:
1. For ANY data question — use db_read or db_query first
2. For system health — use system_status first  
3. For research — use web_search or web_fetch
4. For memory — use memory_write after discoveries, memory_read for context
5. For GitHub — use github_list_files or github_read_file
6. For destructive actions — refuse and require explicit Jeremy confirmation

RESPONSE FORMAT:
If you need to use a tool, respond ONLY with:
TOOL_CALL: <tool_name>
ARGS: <json args>

After receiving tool result, provide your final response.
For multi-step tasks, chain tools one at a time.

GOVERNANCE: Level 4 actions (delete, payment, schema changes) are BLOCKED — always refuse and escalate to Jeremy.`

export interface ARIAMessage { role: "user" | "assistant"; content: string }

export interface ARIAResponse {
  response: string
  toolsUsed: string[]
  memoryUpdated: boolean
  actionsTaken: string[]
  suggestedNextAction?: string
  model: string
  latencyMs: number
}

async function executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  const toolDef = ALL_TOOLS[toolName] as AgentTool | undefined
  if (!toolDef) return { error: `Tool ${toolName} not found` }
  try {
    return await toolDef.execute(args)
  } catch (e) {
    return { error: String(e) }
  }
}

export async function chat(
  message: string,
  history: ARIAMessage[] = [],
  sessionId = "default",
  channel: "web" | "whatsapp" | "slack" = "web"
): Promise<ARIAResponse> {
  const start = Date.now()
  await checkPermission("aria_chat", "aria", { channel })
  await rehydrateSession("aria", sessionId)

  const recentMem = await recallAll("agent-zero", { limit: 3 }).catch(() => [])
  const memCtx = recentMem.length > 0
    ? "\n\nContext from memory:\n" + recentMem.map((m: { key: string; value: unknown }) => `${m.key}: ${JSON.stringify(m.value)}`).join("\n")
    : ""

  const toolsUsed: string[] = []
  const actionsTaken: string[] = []
  let currentMessage = message
  let finalResponse = ""
  let steps = 0

  // Agentic loop — max 8 steps
  while (steps < 8) {
    steps++
    const historyStr = history.slice(-6).map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n")
    
    const { object: step } = await withFallback(() => generateObject({
      model: getModel(),
      schema: z.object({
        action: z.enum(["tool_call", "respond"]),
        tool_name: z.string().optional(),
        tool_args: z.record(z.unknown()).optional(),
        response: z.string().optional(),
        reasoning: z.string(),
      }),
      prompt: `${ARIA_PROMPT}${memCtx}

CONVERSATION HISTORY:
${historyStr}

USER: ${currentMessage}

${actionsTaken.length > 0 ? `TOOLS USED SO FAR: ${actionsTaken.join(", ")}` : ""}
${actionsTaken.length > 0 ? `LAST TOOL RESULT: Available in context above` : ""}

Decide: should you call a tool, or do you have enough info to respond?
If calling a tool, specify which one and the exact args needed.
If responding, provide the complete final answer.`,
    }))

    if (step.action === "respond" || !step.tool_name) {
      finalResponse = step.response || "Task complete."
      break
    }

    // Execute tool
    const toolResult = await executeTool(step.tool_name, step.tool_args || {})
    toolsUsed.push(step.tool_name)
    actionsTaken.push(`${step.tool_name}: ${JSON.stringify(toolResult).slice(0, 150)}`)

    // Update message with tool result for next iteration
    currentMessage = `Original request: ${message}\n\nTool ${step.tool_name} returned: ${JSON.stringify(toolResult).slice(0, 800)}\n\nNow provide the complete response based on this data.`
  }

  if (!finalResponse) finalResponse = actionsTaken.length > 0 ? `Completed. Used: ${toolsUsed.join(", ")}` : "I couldn't find the information needed."

  // Persist
  await dehydrateSession("aria", sessionId, { lastMessage: message.slice(0, 200), toolsUsed, phase: "active", step: String(steps) })
  await remember({ agent_id: "agent-zero", key: `aria_${channel}_last`, value: { msg: message.slice(0, 150), tools: toolsUsed, model: _useOpenAI ? "openai" : "groq" }, memory_type: "episodic", importance: 3 }).catch(() => {})
  await logAction({ agent_id: "aria", action: "chat", level: 0, status: "allowed", details: { channel, tools: toolsUsed, steps } })

  const nextMatch = finalResponse.match(/next (?:suggested )?action[:\s]+([^.!?\n]+)/i)

  return {
    response: finalResponse,
    toolsUsed,
    memoryUpdated: true,
    actionsTaken: actionsTaken.map(a => a.slice(0, 100)),
    suggestedNextAction: nextMatch?.[1]?.trim(),
    model: _useOpenAI ? "gpt-4o-mini" : "llama-3.3-70b-versatile",
    latencyMs: Date.now() - start,
  }
}

export async function processCommand(from: string, text: string): Promise<string> {
  const cmd = text.toLowerCase().trim()
  if (cmd === "status") return (await chat("Use system_status tool and report health in WhatsApp format", [], from, "whatsapp")).response
  if (cmd === "briefing") return (await chat("Use generate_report tool, type leads, format whatsapp", [], from, "whatsapp")).response
  if (cmd === "help") return "🤖 *ARIA Commands*\n\nstatus\nbriefing\nleads [N]\nreport\nhelp\n\nOr ask anything naturally."
  return (await chat(text, [], from, "whatsapp")).response
}

export async function route(task: string): Promise<{ agent: string; result: unknown }> {
  return { agent: "ARIA", result: (await chat(task, [], "system", "web")).response }
}

void recallAll
