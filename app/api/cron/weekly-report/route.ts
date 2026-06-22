/**
 * Weekly Report Cron — Monday 10am ET
 * Vercel Cron: "0 14 * * 1"
 */
import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! })

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getSupabaseAdmin()
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const [companies, calls, pending] = await Promise.all([
    db.from('xps_companies').select('lead_score, priority_tier').gte('created_at', weekAgo.toISOString()),
    db.from('call_logs').select('call_outcome').gte('call_date', weekAgo.toISOString()),
    db.from('approval_queue').select('id').eq('status', 'pending'),
  ])

  const tierCounts = { S: 0, A: 0, B: 0, C: 0, D: 0 }
  companies.data?.forEach((c) => {
    if (c.priority_tier in tierCounts) tierCounts[c.priority_tier as keyof typeof tierCounts]++
  })

  const report = await generateText({
    model: groq('llama-3.3-70b-versatile'),
    messages: [{
      role: 'user',
      content: `Generate a weekly XPS lead pipeline report for Jeremy. WhatsApp format, no markdown.

Week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}

New leads this week: ${companies.data?.length ?? 0}
Tier S (call today): ${tierCounts.S}
Tier A (call this week): ${tierCounts.A}  
Tier B (nurture): ${tierCounts.B}
Calls logged: ${calls.data?.length ?? 0}
Pending outreach approvals: ${pending.data?.length ?? 0}

Write 150 words max. End with 3 recommended actions for the week.`
    }],
    maxTokens: 300,
    temperature: 0.5,
  })

  return NextResponse.json({ success: true, report: report.text, stats: { tierCounts } })
}
