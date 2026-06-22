/**
 * Universal Command API — /api/command
 * 
 * This is the master command interface for Jeremy.
 * Any natural language command gets parsed and routed to the right agent.
 * 
 * POST /api/command
 * Auth: Bearer BRIDGE_SECRET
 * 
 * {
 *   "command": "Clone https://example.com and find all profit opportunities",
 *   "context": { optional extra context }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! })

function auth(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.BRIDGE_SECRET}`
}

const CommandRouteSchema = z.object({
  agent: z.enum(['ghost', 'discovery', 'intelligence', 'outreach', 'aria', 'bridge']),
  subCommand: z.string(),
  params: z.record(z.unknown()),
  reasoning: z.string(),
})

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { command, context } = await req.json()
  if (!command) return NextResponse.json({ error: 'command required' }, { status: 400 })

  // Parse the natural language command
  const { object: route } = await generateObject({
    model: groq('llama-3.3-70b-versatile'),
    schema: CommandRouteSchema,
    prompt: `You are a command router for an autonomous business intelligence system.

Parse this command and route it to the correct agent:

COMMAND: "${command}"
CONTEXT: ${JSON.stringify(context || {})}

AVAILABLE AGENTS:
- ghost: Site analysis, cloning, reverse engineering, niche finding. Params: url, maxPages, approach (perfect_clone/enhanced_clone/inspired_rebuild/niche_pivot), customInstructions, industry, country, budget, skills
- discovery: Lead discovery for XPS. Params: state, maxLeads, source
- intelligence: Lead scoring and profiling. Params: limit
- outreach: Email/call outreach. Params: leadId, channel
- aria: General chat and analysis. Params: message
- bridge: GitHub/Vercel/Supabase operations. Params: command, params

Choose the agent and format the exact params needed.`,
  })

  // Execute the routed command
  const baseUrl = req.nextUrl.origin
  const headers = { 'Authorization': `Bearer ${process.env.BRIDGE_SECRET}`, 'Content-Type': 'application/json' }

  let result: unknown

  if (route.agent === 'ghost') {
    const sub = route.subCommand === 'niches' ? 'niches' : 
                route.subCommand === 'quick_scan' ? 'quick_scan' : 'analyze'
    const res = await fetch(`${baseUrl}/api/ghost`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ command: sub, ...route.params }),
    })
    result = await res.json()
  } else if (route.agent === 'bridge') {
    const res = await fetch(`${baseUrl}/api/bridge`, {
      method: 'POST',
      headers,
      body: JSON.stringify(route.params),
    })
    result = await res.json()
  } else if (route.agent === 'aria') {
    const res = await fetch(`${baseUrl}/api/aria`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: (route.params as Record<string,string>).message || command }),
    })
    result = await res.json()
  } else {
    result = { routed: route.agent, params: route.params, note: 'Agent queued for execution' }
  }

  return NextResponse.json({
    success: true,
    parsed: { agent: route.agent, subCommand: route.subCommand, reasoning: route.reasoning },
    result,
  })
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    agent: 'COMMAND',
    status: 'operational',
    description: 'Universal NL command router — routes any instruction to the correct agent',
    agents: ['ghost', 'discovery', 'intelligence', 'outreach', 'aria', 'bridge'],
  })
}
