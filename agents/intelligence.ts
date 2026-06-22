/**
 * INTELLIGENCE Agent v2 — Lead Scoring + Enrichment Engine
 */
import { generateObject } from "ai"
import { createGroq } from "@ai-sdk/groq"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"
import { getSupabaseAdmin } from "../lib/supabase"
import { remember } from "../lib/memory"
import { logAction } from "../lib/governance"

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! })
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! })
let _useOpenAI = false
function getModel() { return _useOpenAI ? openai("gpt-4o-mini") : groq("llama-3.3-70b-versatile") }

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try { return await fn() }
    catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if ((msg.includes("rate limit") || msg.includes("429") || msg.includes("TPM") || msg.includes("TPD") || msg.includes("quota")) && i < 2) {
        _useOpenAI = true; await new Promise(r => setTimeout(r, 3000 * (i + 1))); continue
      }
      throw e
    }
  }
  throw new Error("Intelligence: max retries")
}

interface ScoredLead { id: string; lead_score: number; priority_tier: string; ai_profile_summary: string; ai_pitch_recommendation: string; ai_next_action: string }

export async function scoreUnscored(limit = 20): Promise<{ processed: number; scored: number; errors: number }> {
  await logAction({ agent_id: "intelligence", action: "score_leads", level: 1, status: "allowed" })
  const db = getSupabaseAdmin()
  const { data: companies } = await db.from("companies").select("*").or("lead_score.is.null,lead_score.eq.0").limit(limit)
  if (!companies?.length) return { processed: 0, scored: 0, errors: 0 }

  let scored = 0, errors = 0
  for (const company of companies) {
    try {
      const { object } = await withRetry(() => generateObject({
        model: getModel(),
        schema: z.object({
          lead_score: z.number().min(0).max(100),
          priority_tier: z.enum(["S","A","B","C","D"]),
          ai_profile_summary: z.string().max(300),
          ai_pitch_recommendation: z.string().max(200),
          ai_next_action: z.string().max(150),
        }),
        prompt: `Score this lead for XPS Intelligence (epoxy/polished concrete products):
Company: ${company.company_name}
Location: ${company.city}, ${company.state}
Phone: ${company.phone || "unknown"}
Notes: ${company.raw_notes || "none"}
Niche: ${company.niche || company.category_guess || "flooring"}

Score 0-100, assign tier (S=90+, A=75-89, B=60-74, C=45-59, D=<45), write profile, pitch, and next action.`,
      }))
      await db.from("companies").update({ ...object, last_enriched_date: new Date().toISOString() }).eq("id", company.id)
      scored++
    } catch { errors++ }
    await new Promise(r => setTimeout(r, 500))
  }

  await remember({ agent_id: "agent-zero", key: "last_scoring_run", value: { processed: companies.length, scored, errors, timestamp: new Date().toISOString() }, memory_type: "episodic", importance: 4 }).catch(() => {})
  return { processed: companies.length, scored, errors }
}

export async function rescoreLead(companyId: string): Promise<ScoredLead | null> {
  const db = getSupabaseAdmin()
  const { data: company } = await db.from("companies").select("*").eq("id", companyId).single()
  if (!company) return null
  try {
    const { object } = await withRetry(() => generateObject({
      model: getModel(),
      schema: z.object({ lead_score: z.number().min(0).max(100), priority_tier: z.enum(["S","A","B","C","D"]), ai_profile_summary: z.string(), ai_pitch_recommendation: z.string(), ai_next_action: z.string() }),
      prompt: `Rescore: ${company.company_name}, ${company.city} ${company.state}. Notes: ${company.raw_notes||"none"}. Score for epoxy/polished concrete sales potential.`,
    }))
    await db.from("companies").update({ ...object, last_enriched_date: new Date().toISOString() }).eq("id", companyId)
    return { id: companyId, ...object }
  } catch { return null }
}
