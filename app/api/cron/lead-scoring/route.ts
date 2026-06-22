/**
 * Lead Scoring Cron — 8am ET daily
 * Vercel Cron: "0 12 * * *"
 */
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { scoreUnscored } = await import('@/agents/intelligence')
  const result = await scoreUnscored(50)
  return NextResponse.json({ success: true, ...result })
}
