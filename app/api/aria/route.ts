/**
 * ARIA Chat API Route
 * POST /api/aria — handles WhatsApp, web chat, and email messages
 * GET  /api/aria — health check
 */

import { NextRequest, NextResponse } from 'next/server'

// Force dynamic — never statically render this route
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, history = [], channel = 'web' } = body

    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 })
    }

    // Lazy import agents at runtime (avoids build-time Supabase init)
    const { chat, route } = await import('@/agents/aria')

    const [routing, response] = await Promise.all([
      route(message),
      chat(message, history, channel),
    ])

    return NextResponse.json({
      response,
      routing,
      timestamp: new Date().toISOString(),
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('ARIA API error:', msg)
    return NextResponse.json({ error: 'ARIA encountered an error', details: msg }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'operational',
    agent: 'ARIA',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  })
}
