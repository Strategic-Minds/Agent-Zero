/**
 * Daily Briefing Cron — 7am ET every morning
 * Vercel Cron schedule: "0 11 * * *" (11:00 UTC = 7:00 AM ET)
 *
 * ARIA pulls overnight data from Supabase and sends Jeremy
 * a strategic morning briefing via WhatsApp.
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { supabaseAdmin } from '@/lib/supabase'
import { logAction } from '@/lib/memory'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! })

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    // Pull data
    const [newLeads, hotLeads, recentCalls] = await Promise.all([
      supabaseAdmin
        .from('xps_companies')
        .select('company_name, city, lead_score, ai_pitch_recommendation')
        .gte('created_at', yesterday.toISOString())
        .order('lead_score', { ascending: false })
        .limit(10),
      supabaseAdmin
        .from('xps_companies')
        .select('company_name, city, phone, lead_score, ai_next_action')
        .gte('lead_score', 70)
        .is('hubspot_company_id', null)
        .order('lead_score', { ascending: false })
        .limit(5),
      supabaseAdmin
        .from('call_logs')
        .select('company_name, call_outcome, next_action, next_action_date')
        .gte('call_date', yesterday.toISOString()),
    ])

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })

    const briefingPrompt = `Generate Jeremy's morning WhatsApp briefing for ${today}.

New leads discovered: ${newLeads.data?.length ?? 0}
Hot leads (score 70+) awaiting action: ${hotLeads.data?.length ?? 0}
Recent calls logged: ${recentCalls.data?.length ?? 0}

Top hot leads:
${hotLeads.data?.map((l) => `• ${l.company_name} (${l.city}) — Score: ${l.lead_score} — ${l.ai_next_action ?? 'No action set'}`).join('\n') || 'None yet'}

New leads preview:
${newLeads.data?.slice(0, 3).map((l) => `• ${l.company_name} — ${(l.ai_pitch_recommendation ?? '').slice(0, 100)}`).join('\n') || 'None yet'}

Write a sharp, strategic morning briefing. WhatsApp format only — no markdown headers.
Use *bold* for key numbers and names. Keep it under 280 words.
End with today's top 3 priorities for Jeremy, numbered.`

    const result = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      messages: [{ role: 'user', content: briefingPrompt }],
      maxTokens: 512,
      temperature: 0.6,
    })

    const briefing = result.text

    // Save to DB
    await supabaseAdmin.from('daily_briefings').insert({
      briefing_date: new Date().toISOString().split('T')[0],
      content: briefing,
      leads_discovered: newLeads.data?.length ?? 0,
      leads_scored: 0,
      outreach_sent: 0,
      meetings_booked: 0,
    })

    await logAction({
      agent_id: 'aria-chief-orchestrator',
      action: 'daily_briefing_generated',
      level: 2,
      status: 'executed',
      details: { preview: briefing.slice(0, 200) },
    })

    return NextResponse.json({
      success: true,
      briefing_preview: briefing.slice(0, 300) + '...',
      stats: {
        new_leads: newLeads.data?.length ?? 0,
        hot_leads: hotLeads.data?.length ?? 0,
        recent_calls: recentCalls.data?.length ?? 0,
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('Daily briefing cron error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
