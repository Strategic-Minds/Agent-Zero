/**
 * Agent Memory Layer v2 — persistent Supabase-backed memory
 * rehydrateSession + dehydrateSession for full session lifecycle
 */
import { getSupabaseAdmin } from "./supabase"

export interface MemoryEntry {
  id?: string
  agent_id: string
  session_id?: string
  memory_type: "episodic" | "semantic" | "procedural" | "working"
  key: string
  value: unknown
  tags?: string[]
  importance?: number
  created_at?: string
  updated_at?: string
  expires_at?: string | null
}

export async function remember(entry: MemoryEntry): Promise<void> {
  const db = getSupabaseAdmin()
  const { error } = await db.from("agent_memory").upsert({ ...entry, updated_at: new Date().toISOString() }, { onConflict: "agent_id,key" })
  if (error) console.error("[memory] write failed:", error.message)
}

export async function recall(agentId: string, key: string): Promise<unknown> {
  const db = getSupabaseAdmin()
  const { data } = await db.from("agent_memory").select("value").eq("agent_id", agentId).eq("key", key).single()
  return data?.value ?? null
}

export async function recallAll(agentId: string, opts?: { limit?: number; type?: string; search?: string }): Promise<MemoryEntry[]> {
  const db = getSupabaseAdmin()
  let q = db.from("agent_memory").select("*").eq("agent_id", agentId).order("importance", { ascending: false }).order("updated_at", { ascending: false }).limit(opts?.limit ?? 20)
  if (opts?.type) q = q.eq("memory_type", opts.type)
  if (opts?.search) q = q.ilike("key", `%${opts.search}%`)
  const { data } = await q
  return (data || []) as MemoryEntry[]
}

export async function forget(agentId: string, key: string): Promise<void> {
  const db = getSupabaseAdmin()
  await db.from("agent_memory").delete().eq("agent_id", agentId).eq("key", key)
}

export async function rehydrateSession(agentId: string, sessionId: string): Promise<Record<string, unknown> | null> {
  try {
    const db = getSupabaseAdmin()
    const { data } = await db.from("agent_sessions").select("*").eq("agent_id", agentId).eq("id", sessionId).single()
    return data as Record<string, unknown> | null
  } catch { return null }
}

export async function dehydrateSession(agentId: string, sessionId: string, context: unknown): Promise<void> {
  try {
    const db = getSupabaseAdmin()
    await db.from("agent_sessions").upsert({ id: sessionId, agent_id: agentId, context, phase: (context as Record<string, unknown>)?.phase || "active", step: (context as Record<string, unknown>)?.step || "1", status: "active", updated_at: new Date().toISOString() }, { onConflict: "id" })
  } catch { /* non-blocking */ }
}
