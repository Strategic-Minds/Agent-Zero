/**
 * Outreach Drafting Cron — 2pm ET weekdays
 * Vercel Cron: "0 18 * * 1-5"
 */
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { generateOutreachBatch } = await import('@/agents/outreach')
  const result = await generateOutreachBatch(10)
  return NextResponse.json({ success: true, ...result })
}
