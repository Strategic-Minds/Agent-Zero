/**
 * DISCOVERY Agent v3 — REAL Lead Scraper (no hallucination, no node-fetch)
 * Uses native fetch() — available in Next.js 14 / Node 18+ globally
 * Sources: AZ Corp Commission + Google Places API + Yelp Fusion API
 */
import { getSupabaseAdmin } from "@/lib/supabase"

export interface DiscoveredLead {
  company_name: string
  phone?: string
  email?: string
  website?: string
  city?: string
  state?: string
  niche?: string
  source: string
}

// ── AZ Corporation Commission public scrape ──────────────────────────────
async function scrapeAZCorpComm(query: string): Promise<DiscoveredLead[]> {
  const leads: DiscoveredLead[] = []
  try {
    const url = `https://ecorp.azcc.gov/BusinessSearch/Results?SearchTerm=${encodeURIComponent(query)}&SearchType=0`
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; XPSBot/1.0; +https://xps.vercel.app)" },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return leads
    const html = await res.text()
    const rows = html.match(/<tr[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi) || []
    for (const row of rows.slice(0, 25)) {
      const nameMatch = row.match(/<td[^>]*>([\w\s&.,'-]{3,60})<\/td>/)
      const phoneMatch = row.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)
      if (nameMatch?.[1]) {
        leads.push({
          company_name: nameMatch[1].trim(),
          phone: phoneMatch?.[0],
          state: "AZ",
          niche: "epoxy_concrete",
          source: "az_corp_comm",
        })
      }
    }
  } catch { /* non-fatal */ }
  return leads
}

// ── Google Places API ────────────────────────────────────────────────────
async function scrapeGooglePlaces(query: string, location = "Arizona"): Promise<DiscoveredLead[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return []
  const leads: DiscoveredLead[] = []
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + " " + location)}&key=${key}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return leads
    const data = await res.json() as { results?: Array<{ name?: string; formatted_phone_number?: string; website?: string; vicinity?: string }> }
    for (const place of (data.results || []).slice(0, 20)) {
      if (place.name) {
        leads.push({
          company_name: place.name,
          phone: place.formatted_phone_number,
          website: place.website,
          city: place.vicinity?.split(",")[0],
          state: "AZ",
          niche: "epoxy_concrete",
          source: "google_places",
        })
      }
    }
  } catch { /* non-fatal */ }
  return leads
}

// ── Yelp Fusion API ──────────────────────────────────────────────────────
async function scrapeYelp(query: string, location = "Phoenix, AZ"): Promise<DiscoveredLead[]> {
  const key = process.env.YELP_API_KEY
  if (!key) return []
  const leads: DiscoveredLead[] = []
  try {
    const url = `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&limit=20`
    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return leads
    const data = await res.json() as { businesses?: Array<{ name?: string; phone?: string; url?: string; location?: { city?: string } }> }
    for (const biz of (data.businesses || [])) {
      if (biz.name) {
        leads.push({
          company_name: biz.name,
          phone: biz.phone,
          website: biz.url,
          city: biz.location?.city,
          state: "AZ",
          niche: "epoxy_concrete",
          source: "yelp",
        })
      }
    }
  } catch { /* non-fatal */ }
  return leads
}

// ── Dedup ────────────────────────────────────────────────────────────────
function dedupe(leads: DiscoveredLead[]): DiscoveredLead[] {
  const seen = new Set<string>()
  return leads.filter(l => {
    const key = l.company_name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── Main export ──────────────────────────────────────────────────────────
export async function runXPSDiscovery(options: {
  niche?: string; location?: string; limit?: number
} = {}): Promise<{ discovered: number; saved: number; leads: DiscoveredLead[] }> {
  const { niche = "epoxy flooring contractor", location = "Arizona", limit = 50 } = options

  const [azRes, googleRes, yelpRes] = await Promise.allSettled([
    scrapeAZCorpComm(niche),
    scrapeGooglePlaces(niche, location),
    scrapeYelp(niche, location),
  ])

  const all: DiscoveredLead[] = [
    ...(azRes.status === "fulfilled" ? azRes.value : []),
    ...(googleRes.status === "fulfilled" ? googleRes.value : []),
    ...(yelpRes.status === "fulfilled" ? yelpRes.value : []),
  ]

  const unique = dedupe(all).slice(0, limit)

  let saved = 0
  if (unique.length > 0) {
    try {
      const db = getSupabaseAdmin()
      for (const lead of unique) {
        const { error } = await db.from("companies" as any).upsert({
          company_name: lead.company_name,
          phone: lead.phone || null,
          website_url: lead.website || null,
          city: lead.city || null,
          state: lead.state || "AZ",
          category_guess: lead.niche || "epoxy_concrete",
          source_type: lead.source,
          entity_status: "Active",
          raw_notes: `Auto-scraped: ${lead.source} — ${new Date().toISOString()}`,
        }, { onConflict: "company_name" })
        if (!error) saved++
      }
    } catch { /* non-fatal */ }
  }

  return { discovered: unique.length, saved, leads: unique }
}

export const runDiscovery = runXPSDiscovery
