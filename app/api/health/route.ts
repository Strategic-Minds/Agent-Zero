/**
 * Health check — confirms all env vars are present at runtime
 * GET /api/health
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const checks = {
    supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase_anon_key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabase_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    groq_api_key: !!process.env.GROQ_API_KEY,
    openai_api_key: !!process.env.OPENAI_API_KEY,
    cron_secret: !!process.env.CRON_SECRET,
  }

  const allGood = Object.values(checks).every(Boolean)

  return NextResponse.json({
    status: allGood ? 'healthy' : 'degraded',
    agent: 'Agent-Zero',
    version: '1.0.0',
    checks,
    timestamp: new Date().toISOString(),
  }, { status: allGood ? 200 : 206 })
}
