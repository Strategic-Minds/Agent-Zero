/**
 * ARIA Chat API Route
 * POST /api/aria
 * Handles WhatsApp, web chat, and email messages
 */

import { NextRequest, NextResponse } from 'next/server'
import { chat, route } from '@/agents/aria'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, history = [], channel = 'web', source } = body

    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 })
    }

    // Route the message to determine if it's a task or conversation
    const routing = await route(message)

    // Generate ARIA response
    const response = await chat(message, history, channel)

    return NextResponse.json({
      response,
      routing,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('ARIA API error:', error)
    return NextResponse.json(
      { error: 'ARIA encountered an error', details: error.message },
      { status: 500 }
    )
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'operational',
    agent: 'ARIA',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  })
}
