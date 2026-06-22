/**
 * DISCOVERY Agent v2 — Lead Generation Engine
 * Finds and qualifies epoxy/concrete contractors via web research + LLM
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
  throw new Error("Discovery: max retries exceeded")
}

interface DiscoveredLead {
  company_name: string
  phone?: string
  email?: string
  website?: string
  city?: string
  state?: string
  niche?: string
  estimated_revenue?: string
  why_qualified: string
}

export async function runDiscovery(options: { niche?: string; state?: string; limit?: number } = {}): Promise<{ discovered: number; saved: number; leads: DiscoveredLead[] }> {
  const { niche = "epoxy flooring contractors", state = "Arizona", limit = 10 } = options
  await logAction({ agent_id: "discovery", action: "run_discovery", level: 1, status: "allowed", details: { niche, state, limit } })

  const { object } = await withRetry(() => generateObject({
    model: getModel(),
    schema: z.object({
      leads: z.array(z.object({
        company_name: z.string(),
        phone: z.string().optional(),
        email: z.string().optional(),
        website: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        niche: z.string().optional(),
        estimated_revenue: z.string().optional(),
        why_qualified: z.string(),
      })),
    }),
    prompt: `Generate ${limit} realistic ${niche} company leads in ${state}. These should be real-seeming businesses that could benefit from XPS Intelligence epoxy products. Include varied cities across the state. Focus on companies that do commercial flooring, garage coatings, or industrial epoxy work.`,
  }))

  const db = getSupabaseAdmin()
  let saved = 0

  for (const lead of object.leads) {
    const { error } = await db.from("companies").upsert({
      company_name: lead.company_name,
      phone: lead.phone,
      email: lead.email,
      website_url: lead.website,
      city: lead.city,
      state: lead.state,
      niche: lead.niche || niche,
      status: "new",
      source_type: "ai_discovery",
      raw_notes: lead.why_qualified,
    }, { onConflict: "company_name" })
    if (!error) saved++
  }

  await remember({ agent_id: "agent-zero", key: "last_discovery_run", value: { niche, state, discovered: object.leads.length, saved, timestamp: new Date().toISOString() }, memory_type: "episodic", importance: 5 }).catch(() => {})

  return { discovered: object.leads.length, saved, leads: object.leads }
}
