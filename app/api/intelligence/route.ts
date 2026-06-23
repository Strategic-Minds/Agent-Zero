/**
 * INTELLIGENCE AGENT — GPT-4o Lead Scoring via Vercel AI Gateway
 * No OpenAI key needed — uses Vercel AI Gateway (OIDC auto-auth)
 * Falls back: Gateway → Groq → OpenAI → heuristic scoring
 */
import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { aiJSON, aiProviderStatus } from "@/lib/ai"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const SCORING_SYSTEM = `You are an expert B2B sales analyst for Xtreme Polishing Systems (XPS), a commercial epoxy flooring and concrete polishing company in Arizona.

Score this business as a potential XPS customer (0-100) based on:
- Industry fit: warehouses, auto shops, restaurants, retail, gyms, hotels = high
- Arizona location = highest priority
- Company size signals
- Decision-maker accessibility
- Estimated flooring square footage

Return ONLY valid JSON:
{
  "score": <0-100>,
  "tier": <"A"|"B"|"C"|"D">,
  "reasoning": "<2 sentences max>",
  "pitch": "<personalized opening line for WhatsApp outreach>",
  "next_action": "<specific recommended action>",
  "estimated_deal_value": <number in USD>
}`

async function scoreCompany(company: { company_name: string; city?: string; category_guess?: string; raw_notes?: string }) {
  const userMsg = `Company: ${company.company_name}
City: ${company.city || "Arizona"}
Category: ${company.category_guess || "Unknown"}
Notes: ${company.raw_notes || "No info"}`

  const result = await aiJSON<{ score: number; tier: string; reasoning: string; pitch: string; next_action: string; estimated_deal_value: number }>(
    SCORING_SYSTEM, userMsg,
    { score: 0, tier: "D", reasoning: "Could not score", pitch: "", next_action: "Research needed", estimated_deal_value: 0 }
  )
  return result
}

function heuristicScore(company: { company_name: string; city?: string; category_guess?: string }): number {
  let score = 40
  const name = (company.company_name || "").toLowerCase()
  const cat = (company.category_guess || "").toLowerCase()
  if (["warehouse","auto","shop","restaurant","hotel","gym","retail"].some(k => name.includes(k) || cat.includes(k))) score += 20
  if (["phoenix","scottsdale","tempe","mesa","chandler","gilbert","glendale"].includes((company.city || "").toLowerCase())) score += 15
  if (cat.includes("epoxy") || cat.includes("flooring") || cat.includes("concrete")) score += 10
  return Math.min(score + Math.floor(Math.random() * 10), 95)
}

export async function POST(req: Request) {
  const db = getSupabaseAdmin()
  const body = await req.json().catch(() => ({})) as { limit?: number; company_id?: string; dry_run?: boolean }
  const limit = Math.min(body.limit || 10, 50)
  const provider = aiProviderStatus()

  let companies: Array<{ id: string; company_name: string; city?: string; category_guess?: string; raw_notes?: string }> = []

  if (body.company_id) {
    const { data } = await db.from("companies" as any).select("*").eq("id", body.company_id).limit(1)
    companies = (data as typeof companies) || []
  } else {
    const { data } = await db.from("companies" as any)
      .select("id,company_name,city,category_guess,raw_notes")
      .is("ai_profile_summary", null)
      .limit(limit)
    companies = (data as typeof companies) || []
  }

  if (!companies.length) {
    return NextResponse.json({ scored: 0, message: "No unscored companies found", provider })
  }

  const results = []
  for (const co of companies) {
    let score: number, tier: string, reasoning: string, pitch: string, next_action: string

    if (provider.active_provider !== "static") {
      const ai = await scoreCompany(co)
      score = Math.max(0, Math.min(100, ai.score || heuristicScore(co)))
      tier = ai.tier || (score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D")
      reasoning = ai.reasoning || ""
      pitch = ai.pitch || ""
      next_action = ai.next_action || "Follow up"
    } else {
      score = heuristicScore(co)
      tier = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D"
      reasoning = `Heuristic score: ${score}/100`
      pitch = `Hi, I am reaching out from XPS about commercial flooring for ${co.company_name}.`
      next_action = "Send initial WhatsApp message"
    }

    const priority = tier === "A" ? "hot" : tier === "B" ? "warm" : "nurture"

    if (!body.dry_run) {
      await db.from("companies" as any).update({
        lead_score: score, priority_tier: priority,
        ai_profile_summary: reasoning,
        ai_pitch_recommendation: pitch,
        ai_next_action: next_action,
        last_enriched_date: new Date().toISOString(),
      }).eq("id", co.id)
    }

    results.push({ id: co.id, name: co.company_name, score, tier, provider: provider.active_provider })
  }

  return NextResponse.json({
    scored: results.length,
    avg_score: Math.round(results.reduce((a, b) => a + b.score, 0) / results.length),
    hot_leads: results.filter(r => r.tier === "A").length,
    provider,
    results,
  })
}

export async function GET() {
  const db = getSupabaseAdmin()
  const provider = aiProviderStatus()
  const { data } = await db.from("companies" as any).select("lead_score,priority_tier").not("lead_score", "is", null)
  const records = (data as Array<{ lead_score: number; priority_tier: string }>) || []
  return NextResponse.json({
    total_scored: records.length,
    avg_score: records.length ? Math.round(records.reduce((a, b) => a + b.lead_score, 0) / records.length) : 0,
    hot: records.filter(r => r.priority_tier === "hot").length,
    warm: records.filter(r => r.priority_tier === "warm").length,
    nurture: records.filter(r => r.priority_tier === "nurture").length,
    provider,
  })
}
