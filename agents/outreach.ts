/**
 * Outreach Agent — Email & WhatsApp Campaign Manager
 * Runs weekdays at 2pm ET via Vercel cron.
 * Pulls priority A/S leads with no outreach history.
 * Generates personalized email drafts → queues for approval.
 * NEVER sends without approval (Level 4 action).
 */

import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { getSupabaseAdmin } from '@/lib/supabase'
import { logAction, remember } from '@/lib/memory'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! })

export const OUTREACH_ID = 'outreach-agent'

export interface OutreachDraft {
  company_id: string
  company_name: string
  contact_email?: string
  contact_phone?: string
  channel: 'email' | 'whatsapp' | 'call'
  subject?: string
  body: string
  status: 'draft' | 'queued' | 'approved' | 'sent' | 'rejected'
}

const XPS_BRAND_VOICE = `
XPS Voice:
- Professional but personable
- Direct — no fluff, no corporate jargon
- Focus on ROI: contractors make more money when they offer epoxy/polished concrete
- Lead with value: XPS provides training, product support, and distributor pricing
- Short emails only — 4-6 sentences max
- Always include a specific CTA (call, demo, sample)
`

/**
 * Generate outreach drafts for top leads — queues for approval, never auto-sends
 */
export async function generateOutreachBatch(limit = 10): Promise<{
  drafted: number
  queued: number
  errors: number
  drafts: OutreachDraft[]
}> {
  const db = getSupabaseAdmin()
  let drafted = 0
  let queued = 0
  let errors = 0
  const drafts: OutreachDraft[] = []

  // Pull top uncontacted leads
  const { data: leads } = await db
    .from('xps_companies')
    .select('id, company_name, city, state, email, phone, lead_score, priority_tier, ai_profile_summary, ai_pitch_recommendation, ai_next_action')
    .in('priority_tier', ['S', 'A'])
    .is('hubspot_company_id', null) // Not yet in HubSpot = not yet contacted
    .order('lead_score', { ascending: false })
    .limit(limit)

  if (!leads?.length) {
    return { drafted: 0, queued: 0, errors: 0, drafts: [] }
  }

  for (const lead of leads) {
    try {
      const draft = await generateEmailDraft(lead as Record<string, unknown>)
      drafted++

      // Queue in approval_queue — NEVER auto-send
      const { error } = await db.from('approval_queue').insert({
        agent_id: OUTREACH_ID,
        action_type: 'send_outreach_email',
        level: 4,
        payload: {
          company_id: lead.id,
          company_name: lead.company_name,
          to_email: lead.email,
          to_phone: lead.phone,
          subject: draft.subject,
          body: draft.body,
          channel: draft.channel,
          lead_score: lead.lead_score,
          priority_tier: lead.priority_tier,
        },
        status: 'pending',
      })

      if (!error) {
        queued++
        drafts.push({
          ...draft,
          company_id: lead.id,
          company_name: lead.company_name,
          contact_email: lead.email,
          contact_phone: lead.phone,
          status: 'queued',
        })
      }
    } catch {
      errors++
    }
  }

  await logAction({
    agent_id: OUTREACH_ID,
    action: 'outreach_batch_generated',
    level: 1,
    status: 'executed',
    details: { drafted, queued, errors },
    requires_approval: true,
  })

  await remember({
    agent_id: OUTREACH_ID,
    memory_type: 'episodic',
    key: `outreach_batch_${new Date().toISOString().split('T')[0]}`,
    value: { drafted, queued, errors, date: new Date().toISOString() },
    tags: ['outreach'],
    importance: 7,
  })

  return { drafted, queued, errors, drafts }
}

/**
 * Generate personalized email draft for one lead
 */
async function generateEmailDraft(lead: Record<string, unknown>): Promise<OutreachDraft> {
  const hasEmail = !!lead.email
  const channel = hasEmail ? 'email' : 'call'

  const result = await generateText({
    model: groq('llama-3.3-70b-versatile'),
    system: `You are the outreach specialist for Xtreme Polishing Systems (XPS).
${XPS_BRAND_VOICE}
Respond ONLY with valid JSON.`,
    messages: [{
      role: 'user',
      content: `Write a cold outreach ${channel === 'email' ? 'email' : 'call script'} for this lead:

Company: ${lead.company_name}
Location: ${lead.city}, ${lead.state}
Profile: ${lead.ai_profile_summary}
Recommended Pitch: ${lead.ai_pitch_recommendation}
Lead Score: ${lead.lead_score}/100

${channel === 'email' ? `Return JSON:
{
  "channel": "email",
  "subject": "string (short, specific, no clickbait)",
  "body": "string (4-6 sentences, plain text, no markdown)"
}` : `Return JSON:
{
  "channel": "call",
  "subject": null,
  "body": "string (60-second call script, conversational, opens with a hook)"
}`}`
    }],
    maxTokens: 400,
    temperature: 0.5,
  })

  try {
    const text = result.text.trim()
    const jsonStart = text.indexOf('{')
    const jsonEnd = text.lastIndexOf('}') + 1
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd))
    return {
      company_id: lead.id as string,
      company_name: lead.company_name as string,
      channel: parsed.channel,
      subject: parsed.subject,
      body: parsed.body,
      status: 'draft',
    }
  } catch {
    return {
      company_id: lead.id as string,
      company_name: lead.company_name as string,
      channel: 'call',
      subject: undefined,
      body: `Hi, this is [Name] from Xtreme Polishing Systems. I'm reaching out because we work with contractors like ${lead.company_name} to add epoxy and polished concrete to their service menu — it's a high-margin upsell that most of your competitors aren't offering yet. Do you have 5 minutes this week?`,
      status: 'draft',
    }
  }
}

/**
 * Pull pending outreach approvals (for ARIA to report to Jeremy)
 */
export async function getPendingApprovals(): Promise<unknown[]> {
  const db = getSupabaseAdmin()
  const { data } = await db
    .from('approval_queue')
    .select('*')
    .eq('agent_id', OUTREACH_ID)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })
    .limit(20)
  return data ?? []
}
