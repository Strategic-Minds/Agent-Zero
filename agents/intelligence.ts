/**
 * Intelligence Agent — Lead Scorer & Profiler
 * Runs every morning at 8am ET via Vercel cron.
 * Reads unscored leads from xps_companies.
 * Scores each lead 0-100, writes AI profile + pitch + next action.
 * Assigns priority tier: S / A / B / C / D
 */

import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { getSupabaseAdmin } from '@/lib/supabase'
import { logAction, remember } from '@/lib/memory'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! })

export const INTELLIGENCE_ID = 'intelligence-agent'

export interface ScoredLead {
  lead_score: number
  priority_tier: 'S' | 'A' | 'B' | 'C' | 'D'
  ai_profile_summary: string
  ai_pitch_recommendation: string
  ai_next_action: string
}

// Scoring rubric
const SCORING_CRITERIA = `
SCORING RUBRIC (0-100):
- Direct epoxy/polished concrete/garage coating = base 60-80
- Adjacent (concrete, flooring, painting) = base 40-60  
- Peripheral (general contractor) = base 20-40
- Has website = +5
- Has phone = +5
- Active entity status = +5
- Formed within last 5 years (growing) = +5
- Phoenix/Scottsdale/Chandler metro = +5 (high density)
- Solo/small operation (easier to convert) = +5
- Already selling related products = -10 (competitor risk)

PRIORITY TIERS:
S = 85-100 (call today, high conversion probability)
A = 70-84 (call this week)
B = 50-69 (call this month, nurture)
C = 30-49 (long-term nurture, email only)
D = 0-29 (not worth pursuing now)
`

/**
 * Score a batch of unscored leads
 */
export async function scoreUnscored(limit = 50): Promise<{
  processed: number
  scored: number
  errors: number
  topLeads: Array<{ company_name: string; lead_score: number; priority_tier: string }>
}> {
  const db = getSupabaseAdmin()
  let processed = 0
  let scored = 0
  let errors = 0
  const topLeads: Array<{ company_name: string; lead_score: number; priority_tier: string }> = []

  // Pull unscored leads
  const { data: leads, error } = await db
    .from('xps_companies')
    .select('id, company_name, city, state, phone, email, website_url, category_guess, adjacency_class, entity_status, formation_date, raw_notes')
    .eq('priority_tier', 'unscored')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error || !leads?.length) {
    return { processed: 0, scored: 0, errors: 0, topLeads: [] }
  }

  await logAction({
    agent_id: INTELLIGENCE_ID,
    action: 'score_batch_start',
    level: 2,
    status: 'allowed',
    details: { count: leads.length },
  })

  // Score in batches of 5 for efficiency
  const batchSize = 5
  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize)

    for (const lead of batch) {
      try {
        const scored_data = await scoreLead(lead)
        processed++

        const { error: updateError } = await db
          .from('xps_companies')
          .update({
            lead_score: scored_data.lead_score,
            priority_tier: scored_data.priority_tier,
            ai_profile_summary: scored_data.ai_profile_summary,
            ai_pitch_recommendation: scored_data.ai_pitch_recommendation,
            ai_next_action: scored_data.ai_next_action,
            last_enriched_date: new Date().toISOString(),
          })
          .eq('id', lead.id)

        if (updateError) {
          errors++
        } else {
          scored++
          if (scored_data.lead_score >= 70) {
            topLeads.push({
              company_name: lead.company_name,
              lead_score: scored_data.lead_score,
              priority_tier: scored_data.priority_tier,
            })
          }
        }
      } catch {
        errors++
      }
    }
  }

  await logAction({
    agent_id: INTELLIGENCE_ID,
    action: 'score_batch_complete',
    level: 2,
    status: 'executed',
    details: { processed, scored, errors, top_count: topLeads.length },
  })

  // Save intelligence memory
  await remember({
    agent_id: INTELLIGENCE_ID,
    memory_type: 'episodic',
    key: `last_score_run_${new Date().toISOString().split('T')[0]}`,
    value: { processed, scored, errors, topLeads: topLeads.slice(0, 5) },
    tags: ['scoring', 'intelligence'],
    importance: 7,
  })

  return { processed, scored, errors, topLeads: topLeads.slice(0, 10) }
}

/**
 * Score a single lead using Groq
 */
async function scoreLead(lead: Record<string, unknown>): Promise<ScoredLead> {
  const result = await generateText({
    model: groq('llama-3.3-70b-versatile'),
    system: `You are the Intelligence Agent for Xtreme Polishing Systems (XPS).
XPS is the largest epoxy and polished concrete products distributor in North America.
Your job is to score and profile contractor leads as potential XPS customers/distributors.

${SCORING_CRITERIA}

Respond ONLY with valid JSON — no other text.`,
    messages: [{
      role: 'user',
      content: `Score this lead for XPS sales potential:

Company: ${lead.company_name}
City: ${lead.city}, ${lead.state}
Phone: ${lead.phone ?? 'unknown'}
Website: ${lead.website_url ?? 'none'}
Category: ${lead.category_guess ?? 'unknown'}
Adjacency: ${lead.adjacency_class ?? 'unknown'}
Status: ${lead.entity_status ?? 'unknown'}
Notes: ${lead.raw_notes ?? 'none'}

Return JSON:
{
  "lead_score": 0-100,
  "priority_tier": "S|A|B|C|D",
  "ai_profile_summary": "2-3 sentence company profile",
  "ai_pitch_recommendation": "Specific XPS pitch for this company (1-2 sentences)",
  "ai_next_action": "Exact next action for sales rep (e.g. Call Tuesday 10am, ask for owner, lead with garage coating demo)"
}`
    }],
    maxTokens: 400,
    temperature: 0.3,
  })

  try {
    const text = result.text.trim()
    const jsonStart = text.indexOf('{')
    const jsonEnd = text.lastIndexOf('}') + 1
    return JSON.parse(text.slice(jsonStart, jsonEnd)) as ScoredLead
  } catch {
    // Fallback score
    return {
      lead_score: 30,
      priority_tier: 'C',
      ai_profile_summary: `${lead.company_name} is a ${lead.category_guess ?? 'contractor'} in ${lead.city}, ${lead.state}.`,
      ai_pitch_recommendation: 'Standard XPS product line introduction. Focus on epoxy coating systems.',
      ai_next_action: 'Add to email nurture sequence. Follow up in 30 days.',
    }
  }
}

/**
 * Re-score a specific company by ID
 */
export async function rescoreLead(companyId: string): Promise<ScoredLead | null> {
  const db = getSupabaseAdmin()

  const { data: lead } = await db
    .from('xps_companies')
    .select('*')
    .eq('id', companyId)
    .single()

  if (!lead) return null

  const scored = await scoreLead(lead as Record<string, unknown>)

  await db.from('xps_companies').update({
    lead_score: scored.lead_score,
    priority_tier: scored.priority_tier,
    ai_profile_summary: scored.ai_profile_summary,
    ai_pitch_recommendation: scored.ai_pitch_recommendation,
    ai_next_action: scored.ai_next_action,
    last_enriched_date: new Date().toISOString(),
  }).eq('id', companyId)

  return scored
}
