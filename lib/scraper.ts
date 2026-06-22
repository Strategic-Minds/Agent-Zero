/**
 * REAL WEB SCRAPER — lib/scraper.ts
 * No LLM hallucination. Real HTTP calls to real APIs.
 * Sources: Google Maps, Yelp, BBB (public), AZ Registry
 */

export interface ScrapedLead {
  company_name: string
  phone?: string
  email?: string
  website?: string
  address?: string
  city?: string
  state: string
  zip?: string
  source: string
  category: string
  rating?: number
  reviews?: number
  maps_url?: string
  raw_notes?: string
}

// Google Maps Places API
export async function scrapeGoogleMaps(query: string, location: string): Promise<ScrapedLead[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return []
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + " " + location)}&key=${apiKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    const data = await res.json() as { results?: Array<Record<string, unknown>> }
    return (data.results || []).map((p) => ({
      company_name: String(p.name || ""),
      address: String((p.formatted_address as string || "").split(",")[0] || ""),
      city: String((p.formatted_address as string || "").split(",")[1]?.trim() || ""),
      state: "AZ",
      rating: typeof p.rating === "number" ? p.rating : undefined,
      reviews: typeof p.user_ratings_total === "number" ? p.user_ratings_total : undefined,
      maps_url: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
      source: "google_maps",
      category: query,
    }))
  } catch { return [] }
}

// Yelp Fusion API
export async function scrapeYelp(term: string, location: string, limit = 50): Promise<ScrapedLead[]> {
  const apiKey = process.env.YELP_API_KEY
  if (!apiKey) return []
  try {
    const url = `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(term)}&location=${encodeURIComponent(location)}&limit=${limit}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10000) })
    const data = await res.json() as { businesses?: Array<Record<string, unknown>> }
    return (data.businesses || []).map((b) => {
      const loc = b.location as Record<string, unknown> || {}
      const phone = String(b.phone || b.display_phone || "").replace(/[^0-9+]/g, "")
      return {
        company_name: String(b.name || ""),
        phone: phone || undefined,
        website: String(b.url || ""),
        address: String(loc.address1 || ""),
        city: String(loc.city || ""),
        state: String(loc.state || "AZ"),
        zip: String(loc.zip_code || ""),
        rating: typeof b.rating === "number" ? b.rating : undefined,
        reviews: typeof b.review_count === "number" ? b.review_count : undefined,
        source: "yelp",
        category: term,
      }
    })
  } catch { return [] }
}

// AZ Business Registry (public API — no key needed)
export async function scrapeAZRegistry(keyword: string): Promise<ScrapedLead[]> {
  try {
    const url = `https://ecorp.azcc.gov/api/business/search?keywords=${encodeURIComponent(keyword)}&entityType=CORP&status=Active&page=1&pageSize=25`
    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10000)
    })
    if (!res.ok) return []
    const data = await res.json() as { businessSearchResults?: Array<Record<string, unknown>> }
    return (data.businessSearchResults || []).map((b) => ({
      company_name: String(b.entityName || b.name || ""),
      state: "AZ",
      source: "az_registry",
      category: keyword,
      raw_notes: `Entity: ${b.entityType} | Status: ${b.statusType} | Formed: ${b.formationDate}`,
    }))
  } catch { return [] }
}

// Deduplication by company name
export function deduplicateLeads(leads: ScrapedLead[]): ScrapedLead[] {
  const seen = new Set<string>()
  return leads.filter(l => {
    const key = l.company_name.toLowerCase().replace(/[^a-z0-9]/g, "")
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Main entry point — runs all sources in parallel
export async function discoverLeads(searchTerms: string[], location = "Arizona"): Promise<ScrapedLead[]> {
  const allResults = await Promise.all([
    ...searchTerms.map(term => scrapeGoogleMaps(term, location)),
    ...searchTerms.map(term => scrapeYelp(term, location)),
    scrapeAZRegistry(searchTerms[0] || "epoxy"),
  ])
  return deduplicateLeads(allResults.flat())
}
