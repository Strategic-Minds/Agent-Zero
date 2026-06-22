/**
 * ARIA Autonomous Bridge — /api/bridge
 * 
 * This is the command interface that lets ARIA (via Base44 or any caller)
 * autonomously operate GitHub, Vercel, and Supabase without human intervention.
 * 
 * Auth: Bearer BRIDGE_SECRET (set in Vercel env vars)
 * 
 * Commands:
 *   github.push       — write a file to the repo
 *   github.read       — read a file from the repo
 *   github.list       — list repo files
 *   github.commit     — get latest commit info
 *   vercel.redeploy   — trigger a new Vercel deployment
 *   vercel.status     — check latest deployment status
 *   vercel.logs       — get function logs
 *   supabase.query    — run a SELECT query
 *   supabase.insert   — insert records
 *   supabase.update   — update records
 *   supabase.delete   — delete records
 *   supabase.rpc      — call a stored procedure
 *   cron.run          — manually trigger any cron route
 *   aria.chat         — send a message to ARIA
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!
const VERCEL_TOKEN = process.env.VERCEL_TOKEN!
const BRIDGE_SECRET = process.env.BRIDGE_SECRET!
const REPO = process.env.GITHUB_REPO ?? 'Strategic-Minds/Agent-Zero'
const VERCEL_PROJECT = process.env.VERCEL_PROJECT_ID ?? ''
const VERCEL_TEAM = process.env.VERCEL_TEAM_ID ?? ''

// ── Auth ───────────────────────────────────────────────────────────────────
function authenticate(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${BRIDGE_SECRET}`
}

// ── GitHub Operations ──────────────────────────────────────────────────────
async function githubPush(path: string, content: string, message: string) {
  const encoded = Buffer.from(content).toString('base64')
  
  // Get existing SHA if file exists
  const existing = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}`,
    { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
  )
  const existingData = existing.ok ? await existing.json() : null
  
  const body: Record<string, string> = { message, content: encoded }
  if (existingData?.sha) body.sha = existingData.sha
  
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify(body),
    }
  )
  const data = await res.json()
  return { success: !!data.content, sha: data.content?.sha, path }
}

async function githubRead(path: string) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}`,
    { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
  )
  const data = await res.json()
  if (!data.content) return { success: false, error: 'File not found' }
  const content = Buffer.from(data.content, 'base64').toString('utf-8')
  return { success: true, content, sha: data.sha, path }
}

async function githubList(dir = '') {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`,
    { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
  )
  const data = await res.json()
  const files = (data.tree ?? [])
    .filter((f: { type: string; path: string }) => f.type === 'blob' && (!dir || f.path.startsWith(dir)))
    .map((f: { path: string; size: number }) => ({ path: f.path, size: f.size }))
  return { success: true, files, count: files.length }
}

async function githubLatestCommit() {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/commits/main`,
    { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
  )
  const data = await res.json()
  return {
    success: true,
    sha: data.sha?.slice(0, 10),
    message: data.commit?.message,
    date: data.commit?.committer?.date,
    author: data.commit?.author?.name,
  }
}

// ── Vercel Operations ──────────────────────────────────────────────────────
async function vercelStatus() {
  const teamParam = VERCEL_TEAM ? `?teamId=${VERCEL_TEAM}` : ''
  const res = await fetch(
    `https://api.vercel.com/v6/deployments${teamParam}&projectId=${VERCEL_PROJECT}&limit=1`,
    { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
  )
  const data = await res.json()
  const latest = data.deployments?.[0]
  if (!latest) return { success: false, error: 'No deployments found' }
  return {
    success: true,
    state: latest.state,
    url: latest.url,
    created: latest.createdAt,
    commit: latest.meta?.githubCommitMessage?.slice(0, 80),
  }
}

async function vercelRedeploy() {
  // Trigger redeploy by pushing an empty commit / calling Vercel deploy hook
  const deployHook = process.env.VERCEL_DEPLOY_HOOK
  if (!deployHook) {
    return { success: false, error: 'VERCEL_DEPLOY_HOOK not set. Add it in Vercel env vars.' }
  }
  const res = await fetch(deployHook, { method: 'POST' })
  const data = await res.json()
  return { success: true, job: data.job?.id ?? 'triggered' }
}

// ── Supabase Operations ────────────────────────────────────────────────────
async function supabaseQuery(table: string, filters?: Record<string, unknown>, limit = 50) {
  const db = getSupabaseAdmin()
  let query = db.from(table).select('*').limit(limit)
  if (filters) {
    for (const [k, v] of Object.entries(filters)) {
      query = query.eq(k, v as string)
    }
  }
  const { data, error } = await query
  return { success: !error, data, error: error?.message, count: data?.length }
}

async function supabaseInsert(table: string, records: Record<string, unknown>[]) {
  const db = getSupabaseAdmin()
  const { data, error } = await db.from(table).insert(records).select()
  return { success: !error, data, error: error?.message }
}

async function supabaseUpdate(table: string, filters: Record<string, unknown>, updates: Record<string, unknown>) {
  const db = getSupabaseAdmin()
  let query = db.from(table).update(updates)
  for (const [k, v] of Object.entries(filters)) {
    query = (query as any).eq(k, v)
  }
  const { data, error } = await (query as any).select()
  return { success: !error, data, error: error?.message }
}

async function supabaseDelete(table: string, filters: Record<string, unknown>) {
  const db = getSupabaseAdmin()
  let query = db.from(table).delete()
  for (const [k, v] of Object.entries(filters)) {
    query = (query as any).eq(k, v)
  }
  const { error } = await query
  return { success: !error, error: error?.message }
}

// ── Cron Manual Trigger ────────────────────────────────────────────────────
async function runCron(cronPath: string) {
  const base = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'https://agent-zero-git-main-strategic-minds-advisory.vercel.app'
  
  const res = await fetch(`${base}${cronPath}`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }
  })
  const data = await res.json()
  return { success: res.ok, status: res.status, ...data }
}

// ── Main Handler ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { command, params = {} } = body as { command: string; params: Record<string, unknown> }

  try {
    let result: unknown

    switch (command) {
      // GitHub
      case 'github.push':
        result = await githubPush(params.path as string, params.content as string, params.message as string ?? 'ARIA autonomous commit')
        break
      case 'github.read':
        result = await githubRead(params.path as string)
        break
      case 'github.list':
        result = await githubList(params.dir as string)
        break
      case 'github.commit':
        result = await githubLatestCommit()
        break

      // Vercel
      case 'vercel.status':
        result = await vercelStatus()
        break
      case 'vercel.redeploy':
        result = await vercelRedeploy()
        break

      // Supabase
      case 'supabase.query':
        result = await supabaseQuery(params.table as string, params.filters as Record<string, unknown>, params.limit as number)
        break
      case 'supabase.insert':
        result = await supabaseInsert(params.table as string, params.records as Record<string, unknown>[])
        break
      case 'supabase.update':
        result = await supabaseUpdate(params.table as string, params.filters as Record<string, unknown>, params.updates as Record<string, unknown>)
        break
      case 'supabase.delete':
        result = await supabaseDelete(params.table as string, params.filters as Record<string, unknown>)
        break

      // Cron
      case 'cron.run':
        result = await runCron(params.path as string)
        break

      // ARIA
      case 'aria.chat': {
        const { chat } = await import('@/agents/aria')
        const response = await chat(params.message as string, [], params.channel as 'web' | 'whatsapp' ?? 'web')
        result = { response }
        break
      }

      default:
        return NextResponse.json({ error: `Unknown command: ${command}` }, { status: 400 })
    }

    return NextResponse.json({ success: true, command, result, timestamp: new Date().toISOString() })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg, command }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'operational',
    bridge: 'ARIA Autonomous Bridge v1',
    commands: [
      'github.push', 'github.read', 'github.list', 'github.commit',
      'vercel.status', 'vercel.redeploy',
      'supabase.query', 'supabase.insert', 'supabase.update', 'supabase.delete',
      'cron.run', 'aria.chat'
    ],
    timestamp: new Date().toISOString(),
  })
}
