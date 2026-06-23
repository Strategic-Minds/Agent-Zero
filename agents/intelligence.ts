/**
 * INTELLIGENCE Agent v3 — Real AI-powered lead scoring
 * Uses GPT-4o-mini / Groq for profile + pitch generation
 */
import { getSupabaseAdmin } from "@/lib/supabase"

export interface ScoredLead {
  company_id: string
  company_name: string
  lead_score: number
  priority_tier: string
  ai_profile_summary: string
  ai_pitch_recommendation: string
  ai_next_action: string
}

function scoreFactors(company: Record<string, unknown>): number {
  let score = 30 // base
  // Formation recency
  const formed = String(company.formation_date || "")
  if (formed) {
    const year = parseInt(formed.slice(0, 4))
    if (year >= 2020) score += 15
    else if (year >= 2015) score += 10
    else if (year >= 2010) score += 5
  }
  // Has website
  if (company.website_url) score += 10
  // Has phone
  if (company.phone) score += 8
  // Has email
  if (company.email) score += 7
  // Active status
  if (String(company.entity_status || "").toLowerCase() === "active") score += 10
  // Category relevance
  const cat = String(company.category_guess || "").toLowerCase()
  if (cat.includes("epoxy") || cat.includes("polish") || cat.includes("floor")) score += 15
  else if (cat.includes("concrete") || cat.includes("coat")) score += 10
  // No prior outreach = fresh opportunity
  if (!company.last_outreach_date) score += 5
  return Math.min(100, score)
}

async function generateAIProfile(company: Record<string, unknown>, score: number): Promise<{
  profile: string; pitch: string; next_action: string
}> {
  const key = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY
  const is_groq = !process.env.OPENAI_API_KEY && !!process.env.GROQ_API_KEY
  const base_url = is_groq ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1"
  const model = is_groq ? "llama-3.1-8b-instant" : "gpt-4o-mini"

  if (!key) {
    return {
      profile: `${company.company_name} — ${company.city || "AZ"} based contractor. Score: ${score}/100.`,
      pitch: "Introduce XPS epoxy/polishing services. Offer free site assessment.",
      next_action: score >= 70 ? "CALL_NOW" : score >= 50 ? "EMAIL_FIRST" : "NURTURE",
    }
  }

  const prompt = `You are an expert B2B sales analyst for Xtreme Polishing Systems (XPS), which sells commercial epoxy flooring and concrete polishing services.
Analyze this lead and provide a JSON response with exactly these fields:
- profile: 2-sentence company profile (what they do, market position)
- pitch: 1-sentence personalized pitch for XPS services
- next_action: one of CALL_NOW, EMAIL_FIRST, LINKEDIN, NURTURE, SKIP

Company data:
Name: ${company.company_name}
City: ${company.city || "AZ"}
Category: ${company.category_guess}
Status: ${company.entity_status}
Score: ${score}/100
Website: ${company.website_url || "none"}

Respond ONLY with valid JSON. No extra text.`

  try {
    const res = await fetch(`${base_url}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: 200, temperature: 0.3 }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error("LLM error")
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const text = data.choices?.[0]?.message?.content || "{}"
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim())
    return {
      profile: parsed.profile || `${company.company_name} — Score ${score}/100`,
      pitch: parsed.pitch || "Offer XPS services",
      next_action: parsed.next_action || "NURTURE",
    }
  } catch {
    return {
      profile: `${company.company_name} — Score ${score}/100`,
      pitch: "Offer XPS epoxy/polishing services. Free site assessment available.",
      next_action: score >= 70 ? "CALL_NOW" : "NURTURE",
    }
  }
}

export async function scoreUnscored(limit = 20): Promise<{ processed: number; scored: number; errors: number }> {
  const db = getSupabaseAdmin()
  const { data: companies } = await db
    .from("companies" as any)
    .select("*")
    .or("lead_score.is.null,lead_score.eq.0")
    .limit(limit)

  if (!companies?.length) return { processed: 0, scored: 0, errors: 0 }

  let scored = 0; let errors = 0
  for (const company of companies) {
    try {
      const score = scoreFactors(company)
      const tier = score >= 80 ? "A" : score >= 65 ? "B" : score >= 45 ? "C" : "D"
      const { profile, pitch, next_action } = await generateAIProfile(company, score)
      await db.from("companies" as any).update({
        lead_score: score,
        priority_tier: tier,
        ai_profile_summary: profile,
        ai_pitch_recommendation: pitch,
        ai_next_action: next_action,
        last_enriched_date: new Date().toISOString(),
      }).eq("id", company.id)
      scored++
    } catch { errors++ }
  }
  return { processed: companies.length, scored, errors }
}

export async function rescoreLead(companyId: string): Promise<ScoredLead | null> {
  const db = getSupabaseAdmin()
  const { data: company } = await db.from("companies" as any).select("*").eq("id", companyId).single()
  if (!company) return null
  const score = scoreFactors(company)
  const tier = score >= 80 ? "A" : score >= 65 ? "B" : score >= 45 ? "C" : "D"
  const { profile, pitch, next_action } = await generateAIProfile(company, score)
  await db.from("companies" as any).update({
    lead_score: score, priority_tier: tier,
    ai_profile_summary: profile, ai_pitch_recommendation: pitch, ai_next_action: next_action,
    last_enriched_date: new Date().toISOString(),
  }).eq("id", companyId)
  return { company_id: companyId, company_name: company.company_name, lead_score: score, priority_tier: tier, ai_profile_summary: profile, ai_pitch_recommendation: pitch, ai_next_action: next_action }
}
