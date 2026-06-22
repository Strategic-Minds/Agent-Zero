/**
 * Agent-Zero Memory Layer
 * Persistent memory via Supabase — survives sessions, restarts, and deployments.
 * Uses lazy Supabase client to avoid build-time crashes.
 */

import { getSupabaseAdmin } from './supabase'

export interface MemoryEntry {
  id?: string
  agent_id: string
  session_id?: string
  memory_type: 'episodic' | 'semantic' | 'procedural' | 'working'
  key: string
  value: unknown
  tags?: string[]
  importance?: number
  created_at?: string
  updated_at?: string
  expires_at?: string | null
}

export interface AgentSession {
  id?: string
  agent_id: string
  phase: string
  step: string
  context: unknown
  status: 'active' | 'paused' | 'complete' | 'blocked'
  started_at?: string
  updated_at?: string
}

export async function remember(entry: MemoryEntry): Promise<void> {
  const db = getSupabaseAdmin()
  const { error } = await db
    .from('agent_memory')
    .upsert({ ...entry, updated_at: new Date().toISOString() }, { onConflict: 'agent_id,key' })
  if (error) throw new Error(`Memory write failed: ${error.message}`)
}

export async function recall(agentId: string, key: string): Promise<unknown> {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('agent_memory')
    .select('value')
    .eq('agent_id', agentId)
    .eq('key', key)
    .single()
  if (error) return null
  return data?.value ?? null
}

export async function searchMemory(agentId: string, tags?: string[], memoryType?: string): Promise<MemoryEntry[]> {
  const db = getSupabaseAdmin()
  let query = db
    .from('agent_memory')
    .select('*')
    .eq('agent_id', agentId)
    .order('importance', { ascending: false })
  if (memoryType) query = query.eq('memory_type', memoryType)
  if (tags?.length) query = (query as any).overlaps('tags', tags)
  const { data } = await query.limit(50)
  return (data as MemoryEntry[]) ?? []
}

export async function dehydrate(session: AgentSession): Promise<void> {
  const db = getSupabaseAdmin()
  const { error } = await db
    .from('agent_sessions')
    .upsert({ ...session, updated_at: new Date().toISOString() }, { onConflict: 'agent_id' })
  if (error) throw new Error(`Session dehydrate failed: ${error.message}`)
}

export async function rehydrate(agentId: string): Promise<AgentSession | null> {
  const db = getSupabaseAdmin()
  const { data } = await db
    .from('agent_sessions')
    .select('*')
    .eq('agent_id', agentId)
    .eq('status', 'active')
    .single()
  return (data as AgentSession) ?? null
}

export async function logAction(params: {
  agent_id: string
  action: string
  level: 0 | 1 | 2 | 3 | 4
  status: 'allowed' | 'blocked' | 'pending_approval' | 'approved' | 'executed'
  details?: unknown
  requires_approval?: boolean
}): Promise<string> {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('agent_audit_log')
    .insert({ ...params, created_at: new Date().toISOString() })
    .select('id')
    .single()
  if (error) throw new Error(`Audit log failed: ${error.message}`)
  return (data as any)?.id ?? ''
}
