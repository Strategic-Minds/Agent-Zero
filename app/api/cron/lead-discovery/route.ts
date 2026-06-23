/**
 * Lead Discovery Cron — 6am ET daily
 * Vercel Cron: "0 10 * * *"
 */
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { runDiscovery } = await import('@/agents/discovery')
  const result = await runDiscovery({ location: 'Arizona', limit: 50 })
  return NextResponse.json({ success: true, ...result })
}
