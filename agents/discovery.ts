/**
 * DISCOVERY Agent v3 — Real web scraping for AZ contractors
 * Uses native fetch (Next.js 13+) — no external deps
 */
import { getSupabaseAdmin } from "@/lib/supabase"

export interface DiscoveredLead {
  company_name: string
  phone?: string
  website?: string
  address?: string
  city?: string
  source: string
  raw_notes?: string
}

// Scrape Google Maps Places API for AZ contractors
async function scrapeGoogleMaps(query: string, location = "33.4484,-112.0740", radius = 50000): Promise<DiscoveredLead[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return []

  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${location}&radius=${radius}&key=${key}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    const data = await res.json() as { results?: Array<{ name?: string; formatted_address?: string; formatted_phone_number?: string; website?: string }> }
    return (data.results || []).map(p => ({
      company_name: p.name || "Unknown",
      address: p.formatted_address,
      phone: p.formatted_phone_number,
      website: p.website,
      city: p.formatted_address?.split(",")[1]?.trim(),
      source: "google_maps",
    }))
  } catch { return [] }
}

// Scrape AZ Corp Commission public search
async function scrapeAZCorpComm(keyword: string): Promise<DiscoveredLead[]> {
  try {
    const url = `https://ecorp.azcc.gov/BusinessSearch/Business?name=${encodeURIComponent(keyword)}&type=LLC`
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; XPS-Scout/1.0)" },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const html = await res.text()
    // Parse basic company names from response
    const matches = html.match(/class="business-name"[^>]*>([^<]+)</g) || []
    return matches.slice(0, 20).map(m => ({
      company_name: m.replace(/class="business-name"[^>]*>/, "").replace(/<.*/, "").trim(),
      source: "az_corp_comm",
      city: "Arizona",
    }))
  } catch { return [] }
}

export async function runXPSDiscovery(limit = 50): Promise<{
  discovered: number; saved: number; sources: string[]; errors: number
}> {
  const db = getSupabaseAdmin()
  const queries = [
    "epoxy flooring contractor Arizona",
    "concrete polishing Arizona",
    "garage floor coating Phoenix",
    "commercial flooring contractor Tucson",
    "decorative concrete Arizona",
  ]

  let all_leads: DiscoveredLead[] = []
  let errors = 0
  const sources: string[] = []

  // Run Google Maps scrapes in parallel
  const gmaps_results = await Promise.allSettled(
    queries.slice(0, 3).map(q => scrapeGoogleMaps(q))
  )
  for (const r of gmaps_results) {
    if (r.status === "fulfilled") {
      all_leads.push(...r.value)
      if (r.value.length > 0) sources.push("google_maps")
    } else { errors++ }
  }

  // AZ Corp Commission
  try {
    const az_leads = await scrapeAZCorpComm("epoxy")
    all_leads.push(...az_leads)
    if (az_leads.length > 0) sources.push("az_corp_comm")
  } catch { errors++ }

  // Deduplicate by name
  const seen = new Set<string>()
  const unique_leads = all_leads.filter(l => {
    const key = l.company_name.toLowerCase().replace(/[^a-z0-9]/g, "")
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, limit)

  // Save to DB
  let saved = 0
  for (const lead of unique_leads) {
    try {
      const { error } = await db.from("companies" as any).upsert({
        company_name: lead.company_name,
        phone: lead.phone,
        website_url: lead.website,
        city: lead.city || "Arizona",
        state: "AZ",
        source_type: lead.source,
        raw_notes: lead.raw_notes,
        entity_status: "Active",
        category_guess: "Epoxy/Flooring Contractor",
      }, { onConflict: "company_name" })
      if (!error) saved++
    } catch { /* skip duplicates */ }
  }

  // Log scrape run
  try {
    await db.from("scrape_runs" as any).insert({
      run_name: `discovery_${Date.now()}`,
      run_date: new Date().toISOString(),
      source: sources.join(",") || "none",
      total_records: unique_leads.length,
      new_records: saved,
      duplicates_skipped: unique_leads.length - saved,
      status: "completed",
    })
  } catch { /* non-fatal */ }

  return { discovered: unique_leads.length, saved, sources: [...new Set(sources)], errors }
}

// Legacy alias for backward compatibility
export const discoverLeads = runXPSDiscovery
export const getGoogleMapsPlaces = async (terms: string, location: string, radius: number) =>
  scrapeGoogleMaps(terms, location, radius)
export const getAzCorpCommission = async () => []
