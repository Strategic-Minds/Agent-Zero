/**
 * Daily Briefing Cron — runs every morning at 7am ET
 * Vercel Cron: 0 11 * * * (11 UTC = 7am ET)
 * 
 * ARIA analyzes overnight activity and sends Jeremy a WhatsApp briefing
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { supabaseAdmin } from '@/lib/memory'
import { remember, logAction } from '@/lib/memory'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Pull yesterday's data
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const { data: newLeads } = await supabaseAdmin
      .from('xps_companies')
      .select('company_name, city, lead_score, ai_pitch_recommendation')
      .gte('created_at', yesterday.toISOString())
      .order('lead_score', { ascending: false })
      .limit(10)

    const { data: hotLeads } = await supabaseAdmin
      .from('xps_companies')
      .select('company_name, city, phone, lead_score, ai_next_action')
      .gte('lead_score', 70)
      .is('hubspot_company_id', null)
      .order('lead_score', { ascending: false })
      .limit(5)

    const { data: recentCalls } = await supabaseAdmin
      .from('call_logs')
      .select('company_name, call_outcome, next_action, next_action_date')
      .gte('call_date', yesterday.toISOString())

    // Generate briefing with ARIA
    const briefingPrompt = `
Generate Jeremy's morning WhatsApp briefing for ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.

New leads discovered: ${newLeads?.length ?? 0}
Hot leads (score 70+) awaiting action: ${hotLeads?.length ?? 0}
Recent calls: ${recentCalls?.length ?? 0}

Top hot leads:
${hotLeads?.map(l => `• ${l.company_name} (${l.city}) — Score: ${l.lead_score} — ${l.ai_next_action}`).join('\n') ?? 'None'}

New leads preview:
${newLeads?.slice(0, 3).map(l => `• ${l.company_name} — ${l.ai_pitch_recommendation?.slice(0, 100)}`).join('\n') ?? 'None'}

Write a sharp, strategic morning briefing. WhatsApp format only — no markdown.
Use *bold* for key numbers. Keep it under 300 words.
End with today's top 3 priorities for Jeremy.
`

    const result = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      messages: [{ role: 'user', content: briefingPrompt }],
      maxTokens: 512,
      temperature: 0.6
    })

    const briefing = result.text

    // Save briefing to DB
    await supabaseAdmin.from('daily_briefings').insert({
      briefing_date: new Date().toISOString().split('T')[0],
      content: briefing,
      leads_discovered: newLeads?.length ?? 0,
      leads_scored: 0,
      outreach_sent: 0,
      meetings_booked: 0
    })

    // TODO: Send via WhatsApp Business API
    // For now, log it
    await logAction({
      agent_id: 'aria-chief-orchestrator',
      action: 'daily_briefing_generated',
      level: 2,
      status: 'executed',
      details: { briefing_preview: briefing.slice(0, 200) }
    })

    console.log('Daily briefing generated:', briefing.slice(0, 200))

    return NextResponse.json({
      success: true,
      briefing: briefing.slice(0, 200) + '...',
      stats: {
        new_leads: newLeads?.length ?? 0,
        hot_leads: hotLeads?.length ?? 0,
        recent_calls: recentCalls?.length ?? 0
      }
    })

  } catch (error: any) {
    console.error('Daily briefing cron error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
