/**
 * ARIA v2.0 — Full tool use via manual tool execution loop (ai@3.x compatible)
 * Groq-only (llama-3.3-70b) — no OpenAI fallback (quota exceeded)
 */
import { generateObject } from "ai"
import { createGroq } from "@ai-sdk/groq"
import { z } from "zod"
import { ALL_TOOLS, AgentTool } from "../lib/tools"
import { remember, recallAll, rehydrateSession, dehydrateSession } from "../lib/memory"
import { checkPermission, logAction } from "../lib/governance"

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! })

function getModel() {
  return groq("llama-3.1-8b-instant")
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try { return await fn() }
    catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if ((msg.includes("rate limit") || msg.includes("429") || msg.includes("TPM") || msg.includes("TPD") || msg.includes("quota") || msg.includes("exceeded")) && i < 2) {
        await new Promise(r => setTimeout(r, 4000 * (i + 1)))
        continue
      }
      throw e
    }
  }
  throw new Error("Groq rate limit — please retry in a moment")
}

const TOOL_NAMES = Object.keys(ALL_TOOLS).join(", ")

const ARIA_PROMPT = `You are ARIA — the sovereign intelligence agent for Strategic Minds Advisory / XPS Intelligence.
You work exclusively for Jeremy Bensen. You are autonomous, strategic, results-focused.

AVAILABLE TOOLS: ${TOOL_NAMES}

RULES:
1. For data questions — use db_read or db_query
2. For system health — use system_status
3. For research — use web_search or web_fetch
4. After discoveries — use memory_write
5. For GitHub — use github_list_files or github_read_file
6. Destructive actions (delete, bulk wipe) — REFUSE, require explicit Jeremy confirmation
7. Always end significant responses with "Next suggested action: [specific]"

GOVERNANCE: Level 4 actions (delete, payments, schema changes) are BLOCKED — refuse and escalate.`

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
  if (!toolDef) return { error: `Tool "${toolName}" not found. Available: ${TOOL_NAMES}` }
  try { return await toolDef.execute(args) }
  catch (e) { return { error: String(e).slice(0, 200) } }
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
    ? "\n\nMemory context:\n" + recentMem.map((m: { key: string; value: unknown }) => `${m.key}: ${JSON.stringify(m.value)}`).join("\n")
    : ""

  const toolsUsed: string[] = []
  const actionsTaken: string[] = []
  let currentMessage = message
  let finalResponse = ""
  let steps = 0

  while (steps < 8) {
    steps++
    const historyStr = history.slice(-6).map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n")
    const toolResultsCtx = actionsTaken.length > 0 ? `\n\nTools used so far:\n${actionsTaken.slice(-3).join("\n")}` : ""

    const { object: step } = await withRetry(() => generateObject({
      model: getModel(),
      schema: z.object({
        action: z.enum(["tool_call", "respond"]),
        tool_name: z.string().optional(),
        tool_args: z.record(z.unknown()).optional(),
        response: z.string().optional(),
        reasoning: z.string().max(200),
      }),
      prompt: `${ARIA_PROMPT}${memCtx}${toolResultsCtx}

CONVERSATION:
${historyStr}
USER: ${currentMessage}

Decide: call a tool OR respond with final answer. 
If you need real data, call a tool first. 
If you already have enough info or just used tools, respond.`,
    }))

    if (step.action === "respond" || !step.tool_name) {
      finalResponse = step.response || "Task complete."
      break
    }

    const toolResult = await executeTool(step.tool_name, step.tool_args || {})
    toolsUsed.push(step.tool_name)
    const resultStr = JSON.stringify(toolResult).slice(0, 500)
    actionsTaken.push(`${step.tool_name} → ${resultStr}`)
    currentMessage = `Original: ${message}\n\nTool "${step.tool_name}" returned: ${resultStr}\n\nNow provide the complete final response based on this data.`
  }

  if (!finalResponse) {
    finalResponse = actionsTaken.length > 0
      ? `Completed ${toolsUsed.join(", ")}. ${actionsTaken[actionsTaken.length-1]?.split("→")[1]?.trim() || ""}`
      : "I need more information to complete this task."
  }

  await dehydrateSession("aria", sessionId, { lastMessage: message.slice(0, 200), toolsUsed, phase: "active", step: String(steps) })
  await remember({ agent_id: "agent-zero", key: `aria_${channel}_last`, value: { msg: message.slice(0, 100), tools: toolsUsed }, memory_type: "episodic", importance: 3 }).catch(() => {})
  await logAction({ agent_id: "aria", action: "chat", level: 0, status: "allowed", details: { channel, tools: toolsUsed, steps } })

  const nextMatch = finalResponse.match(/next (?:suggested )?action[:\s]+([^.!?\n]+)/i)

  return {
    response: finalResponse,
    toolsUsed,
    memoryUpdated: true,
    actionsTaken: actionsTaken.map(a => a.slice(0, 120)),
    suggestedNextAction: nextMatch?.[1]?.trim(),
    model: "llama-3.1-8b-instant",
    latencyMs: Date.now() - start,
  }
}

export async function processCommand(from: string, text: string): Promise<string> {
  const cmd = text.toLowerCase().trim()
  if (cmd === "status") return (await chat("Use system_status tool and report full system health", [], from, "whatsapp")).response
  if (cmd === "briefing" || cmd === "daily briefing") return (await chat("Use generate_report tool, type leads, format whatsapp", [], from, "whatsapp")).response
  if (cmd === "help") return "🤖 *ARIA Commands*\n\nstatus\nbriefing\nleads [N]\nreport\nhelp\n\nOr ask anything naturally."
  return (await chat(text, [], from, "whatsapp")).response
}

export async function route(task: string): Promise<{ agent: string; result: unknown }> {
  return { agent: "ARIA", result: (await chat(task, [], "system", "web")).response }
}
