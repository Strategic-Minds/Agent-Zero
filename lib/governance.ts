/**
 * AGENT ZERO — GOVERNANCE ENGINE v2.0
 * Runtime enforcement of the 5-level Autonomy Matrix
 */
import { getSupabaseAdmin } from "./supabase"

export type ActionLevel = 0 | 1 | 2 | 3 | 4

export function classifyAction(action: string): ActionLevel {
  const a = action.toLowerCase()
  if (a.includes("read") || a.includes("list") || a.includes("get") || a.includes("status") || a.includes("search") || a.includes("health") || a.includes("recall") || a.includes("report")) return 0
  if (a.includes("draft") || a.includes("generate") || a.includes("analyze") || a.includes("plan") || a.includes("memory_write") || a.includes("summarize")) return 1
  if (a.includes("github_write") || a.includes("supabase_write") || a.includes("db_create") || a.includes("db_update") || a.includes("preview")) return 2
  if (a.includes("email_send") || a.includes("whatsapp_send") || a.includes("deploy") || a.includes("hubspot_write") || a.includes("outreach_send") || a.includes("calendar_create")) return 3
  if (a.includes("delete") || a.includes("stripe") || a.includes("payment") || a.includes("schema_migrate") || a.includes("secret") || a.includes("rotate")) return 4
  return 2
}

export async function logAction(params: { agent_id: string; action: string; level: ActionLevel; status: string; details?: Record<string, unknown>; result?: unknown }): Promise<void> {
  try {
    const db = getSupabaseAdmin()
    await db.from("agent_actions").insert({ agent_id: params.agent_id, action: params.action, level: params.level, status: params.status, details: params.details ?? {}, result: params.result ?? null, created_at: new Date().toISOString() })
  } catch { /* non-blocking */ }
}

export async function checkPermission(action: string, agentId = "agent-zero", context?: Record<string, unknown>): Promise<{ allowed: boolean; level: ActionLevel; reason: string }> {
  const level = classifyAction(action)
  if (level <= 2) {
    logAction({ agent_id: agentId, action, level, status: "allowed", details: context }).catch(() => {})
    return { allowed: true, level, reason: level === 0 ? "Read-only — auto-approved" : level === 1 ? "Draft/planning — auto-approved" : "Sandbox write — auto-approved" }
  }
  if (level === 4) {
    logAction({ agent_id: agentId, action, level, status: "blocked", details: context }).catch(() => {})
    return { allowed: false, level, reason: "Level 4 — requires explicit Jeremy session instruction" }
  }
  logAction({ agent_id: agentId, action, level, status: "allowed", details: context }).catch(() => {})
  return { allowed: true, level, reason: "Level 3 — logged, notify Jeremy" }
}
