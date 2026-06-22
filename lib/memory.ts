/**
 * Agent-Zero Memory Layer
 * Persistent memory via Supabase — survives sessions, restarts, and deployments.
 * Every agent reads/writes here. This is the brain's long-term storage.
 */

import { supabaseAdmin } from './supabase'

export interface MemoryEntry {
  id?: string
  agent_id: string
  session_id?: string
  memory_type: 'episodic' | 'semantic' | 'procedural' | 'working'
  key: string
  value: any
  tags?: string[]
  importance?: number // 1-10
  created_at?: string
  updated_at?: string
  expires_at?: string | null
}

export interface AgentSession {
  id?: string
  agent_id: string
  phase: string
  step: string
  context: any
  status: 'active' | 'paused' | 'complete' | 'blocked'
  started_at?: string
  updated_at?: string
}

// Write a memory entry
export async function remember(entry: MemoryEntry): Promise<void> {
  const { error } = await supabaseAdmin
    .from('agent_memory')
    .upsert({
      ...entry,
      updated_at: new Date().toISOString()
    }, { onConflict: 'agent_id,key' })

  if (error) throw new Error(`Memory write failed: ${error.message}`)
}

// Read a memory entry
export async function recall(agentId: string, key: string): Promise<any | null> {
  const { data, error } = await supabaseAdmin
    .from('agent_memory')
    .select('value')
    .eq('agent_id', agentId)
    .eq('key', key)
    .single()

  if (error) return null
  return data?.value ?? null
}

// Search memory by tags or type
export async function searchMemory(agentId: string, tags?: string[], memoryType?: string): Promise<MemoryEntry[]> {
  let query = supabaseAdmin
    .from('agent_memory')
    .select('*')
    .eq('agent_id', agentId)
    .order('importance', { ascending: false })

  if (memoryType) query = query.eq('memory_type', memoryType)
  if (tags && tags.length > 0) query = query.overlaps('tags', tags)

  const { data, error } = await query.limit(50)
  if (error) return []
  return data ?? []
}

// Save agent session state (dehydrate)
export async function dehydrate(session: AgentSession): Promise<void> {
  const { error } = await supabaseAdmin
    .from('agent_sessions')
    .upsert({
      ...session,
      updated_at: new Date().toISOString()
    }, { onConflict: 'agent_id' })

  if (error) throw new Error(`Session dehydrate failed: ${error.message}`)
}

// Load agent session state (rehydrate)
export async function rehydrate(agentId: string): Promise<AgentSession | null> {
  const { data, error } = await supabaseAdmin
    .from('agent_sessions')
    .select('*')
    .eq('agent_id', agentId)
    .eq('status', 'active')
    .single()

  if (error) return null
  return data
}

// Log an agent action for governance/audit
export async function logAction(params: {
  agent_id: string
  action: string
  level: 0 | 1 | 2 | 3 | 4
  status: 'allowed' | 'blocked' | 'pending_approval' | 'approved' | 'executed'
  details?: any
  requires_approval?: boolean
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('agent_audit_log')
    .insert({
      ...params,
      created_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (error) throw new Error(`Audit log failed: ${error.message}`)
  return data?.id
}
