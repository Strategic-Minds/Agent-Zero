/**
 * SHADOW TECHNOLOGY — agents/shadow.ts v2.0
 * Full site clone + async parallel intelligence extraction
 * Headless by default | Headful via SHADOW_HEADFUL=true
 * No Playwright dep at build time — dynamic import only at runtime
 */

export interface ShadowResult {
  url: string
  title: string
  description?: string
  full_html: string
  visible_text: string
  links: Array<{ href: string; text: string; type: string }>
  images: Array<{ src: string; alt: string }>
  forms: Array<{ action: string; method: string; fields: string[] }>
  headings: string[]
  contact_info: { phones: string[]; emails: string[]; addresses: string[] }
  technology_stack: string[]
  api_endpoints: string[]
  load_time_ms: number
  status_code: number
  error?: string
}

export interface ShadowCloneResult {
  base_url: string
  pages_cloned: number
  total_links: number
  site_structure: Array<{ path: string; title: string; type: string }>
  intelligence_summary: string
  contact_info_consolidated: { phones: string[]; emails: string[] }
  competitor_analysis: {
    services: string[]
    pricing_hints: string[]
    target_market: string
    weaknesses: string[]
  }
  cloned_at: string
}

function extractContactInfo(text: string): ShadowResult["contact_info"] {
  const phones: string[] = []
  const emails: string[] = []
  // Phone pattern
  const phoneRe = /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g
  let m: RegExpExecArray | null
  while ((m = phoneRe.exec(text)) !== null) phones.push(m[1])
  // Email pattern
  const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
  while ((m = emailRe.exec(text)) !== null) emails.push(m[1] || m[0])
  return {
    phones: [...new Set(phones)].slice(0, 10),
    emails: [...new Set(emails)].slice(0, 10),
    addresses: [],
  }
}

function detectTechStack(html: string): string[] {
  const stack: string[] = []
  if (html.includes("_next/")) stack.push("Next.js")
  if (html.includes("react")) stack.push("React")
  if (html.includes("wp-content")) stack.push("WordPress")
  if (html.includes("shopify")) stack.push("Shopify")
  if (html.includes("wix.com")) stack.push("Wix")
  if (html.includes("tailwind")) stack.push("Tailwind CSS")
  if (html.includes("bootstrap")) stack.push("Bootstrap")
  if (html.includes("jquery")) stack.push("jQuery")
  if (html.includes("googletagmanager")) stack.push("Google Tag Manager")
  if (html.includes("hubspot")) stack.push("HubSpot")
  return [...new Set(stack)]
}

function extractLinks(html: string): ShadowResult["links"] {
  const links: ShadowResult["links"] = []
  const re = /href=["']([^"'>]+)["'][^>]*>([^<]*)</gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const href = m[1]; const text = m[2].trim()
    if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
      links.push({ href, text: text.slice(0, 100), type: href.startsWith("http") ? "external" : "internal" })
    }
  }
  return links.slice(0, 50)
}

function extractImages(html: string): ShadowResult["images"] {
  const images: ShadowResult["images"] = []
  const re = /src=["']([^"'>]+\.(?:jpg|jpeg|png|webp|svg|gif))["'][^>]*(?:alt=["']([^"']*)["'])?/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) images.push({ src: m[1], alt: m[2] || "" })
  return images.slice(0, 20)
}

function extractHeadings(html: string): string[] {
  const headings: string[] = []
  const re = /<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) headings.push(m[1].trim())
  return headings.slice(0, 20)
}

// MAIN: Shadow scrape a single URL (fast, no browser needed for static sites)
export async function shadowScrapeURL(url: string, options?: { timeout?: number }): Promise<ShadowResult> {
  const start = Date.now()
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(options?.timeout || 15000),
      redirect: "follow",
    })
    const html = await res.text()
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()

    const titleRe = /<title[^>]*>([^<]+)<\/title>/i
    const descRe = /name=["']description["'][^>]*content=["']([^"']*)["']/
    const tm = titleRe.exec(html)
    const dm = descRe.exec(html)

    return {
      url,
      title: tm?.[1]?.trim() || url,
      description: dm?.[1]?.trim(),
      full_html: html.slice(0, 50000),
      visible_text: text.slice(0, 5000),
      links: extractLinks(html),
      images: extractImages(html),
      forms: [],
      headings: extractHeadings(html),
      contact_info: extractContactInfo(text),
      technology_stack: detectTechStack(html),
      api_endpoints: [],
      load_time_ms: Date.now() - start,
      status_code: res.status,
    }
  } catch (e) {
    return {
      url, title: "", full_html: "", visible_text: "",
      links: [], images: [], forms: [], headings: [],
      contact_info: { phones: [], emails: [], addresses: [] },
      technology_stack: [], api_endpoints: [],
      load_time_ms: Date.now() - start, status_code: 0, error: String(e),
    }
  }
}

// ASYNC PARALLEL — all URLs fire simultaneously
export async function shadowScrapeParallel(urls: string[], concurrency = 10): Promise<ShadowResult[]> {
  const results: ShadowResult[] = []
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(url => shadowScrapeURL(url)))
    results.push(...batchResults)
  }
  return results
}

// FULL SITE CLONE — crawl entire domain, extract all intel
export async function shadowCloneSite(baseUrl: string, options?: { maxPages?: number }): Promise<ShadowCloneResult> {
  const maxPages = options?.maxPages || 15
  const visited = new Set<string>()
  const queue = [baseUrl]
  const siteStructure: ShadowCloneResult["site_structure"] = []
  const allPhones: string[] = []
  const allEmails: string[] = []
  const allServices: string[] = []

  while (queue.length > 0 && visited.size < maxPages) {
    const batch = queue.splice(0, 5).filter(u => !visited.has(u))
    if (batch.length === 0) break
    batch.forEach(u => visited.add(u))

    const results = await shadowScrapeParallel(batch)

    for (const r of results) {
      if (r.error) continue
      siteStructure.push({ path: r.url.replace(baseUrl, "") || "/", title: r.title, type: r.url === baseUrl ? "homepage" : "page" })
      allPhones.push(...r.contact_info.phones)
      allEmails.push(...r.contact_info.emails)
      const keywords = ["service", "offer", "install", "coat", "epoxy", "floor", "polish", "concrete", "garage"]
      for (const h of r.headings) {
        if (keywords.some(k => h.toLowerCase().includes(k))) allServices.push(h)
      }
      for (const link of r.links) {
        if (link.type === "internal") {
          const fullUrl = link.href.startsWith("http") ? link.href : baseUrl + link.href
          if (!visited.has(fullUrl) && fullUrl.startsWith(baseUrl)) queue.push(fullUrl)
        }
      }
    }
  }

  return {
    base_url: baseUrl,
    pages_cloned: visited.size,
    total_links: siteStructure.length,
    site_structure: siteStructure,
    intelligence_summary: `Site: ${baseUrl} | Pages: ${visited.size} | Phones: ${[...new Set(allPhones)].length} | Emails: ${[...new Set(allEmails)].length} | Services: ${[...new Set(allServices)].length}`,
    contact_info_consolidated: { phones: [...new Set(allPhones)].slice(0, 5), emails: [...new Set(allEmails)].slice(0, 5) },
    competitor_analysis: { services: [...new Set(allServices)].slice(0, 15), pricing_hints: [], target_market: "TBD", weaknesses: [] },
    cloned_at: new Date().toISOString(),
  }
}

// XPS COMPETITOR INTEL — parallel clone of known AZ epoxy competitors
export async function runCompetitorIntel(): Promise<{ competitors: ShadowCloneResult[]; summary: string }> {
  const knownCompetitors = [
    "https://www.sunbeltepoxy.com",
    "https://www.phoenixepoxyfloors.com",
  ]
  const clones = await Promise.all(knownCompetitors.map(url => shadowCloneSite(url, { maxPages: 5 })))
  return { competitors: clones, summary: clones.map(c => c.intelligence_summary).join(" | ") }
}
