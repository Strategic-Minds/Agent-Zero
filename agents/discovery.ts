/**
 * DISCOVERY AGENT — agents/discovery.ts v3.0
 * REAL scraping only — no LLM hallucination
 * Uses lib/scraper.ts with async parallel execution
 * Stores real leads to Supabase
 */
import { getSupabaseAdmin } from "../lib/supabase"
import { discoverLeads, discoverXPSLeads, type ScrapedLead } from "../lib/scraper"

export async function runDiscovery(options?: {
  searchTerms?: string[]
  location?: string
  maxLeads?: number
}): Promise<{ discovered: number; stored: number; leads: ScrapedLead[] }> {
  const db = getSupabaseAdmin()
  const terms = options?.searchTerms || [
    "epoxy flooring contractor",
    "concrete coating contractor",
    "garage floor coating",
    "polished concrete contractor",
  ]
  const location = options?.location || "Arizona"

  // Real parallel scraping
  const leads = await discoverLeads(terms, location)
  const limited = leads.slice(0, options?.maxLeads || 50)

  // Store to Supabase
  let stored = 0
  for (const lead of limited) {
    try {
      const { error } = await db.from("companies").upsert({
        company_name: lead.company_name,
        phone: lead.phone || null,
        email: lead.email || null,
        website_url: lead.website || null,
        city: lead.city || null,
        state: lead.state || "AZ",
        source_type: lead.source,
        category_guess: lead.category,
        raw_notes: lead.raw_notes || `Rating: ${lead.rating || "N/A"} | Reviews: ${lead.reviews || 0}`,
        maps_link: lead.maps_url || null,
      }, { onConflict: "company_name" })
      if (!error) stored++
    } catch { /* continue */ }
  }

  console.log(`[DISCOVERY] Scraped ${leads.length} leads → stored ${stored} in Supabase`)
  return { discovered: leads.length, stored, leads: limited }
}

export async function runXPSDiscovery() {
  return runDiscovery({
    searchTerms: ["epoxy flooring contractor", "concrete coating contractor", "garage floor coating", "polished concrete contractor", "decorative concrete Arizona"],
    location: "Arizona",
    maxLeads: 100,
  })
}
