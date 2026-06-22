/**
 * SHADOW TECHNOLOGY v2.0 — agents/shadow.ts
 * Full site clone, intelligence extraction, competitor analysis
 * Async parallel scraping — all pages simultaneously
 * Heads up and headless Playwright when available
 */

export interface ShadowResult {
  url: string
  title: string
  description: string
  visible_text: string
  links: Array<{ href: string; text: string; type: string }>
  images: Array<{ src: string; alt: string }>
  headings: string[]
  phones: string[]
  emails: string[]
  technology_stack: string[]
  load_time_ms: number
  status_code: number
  error?: string
}

export interface ShadowCloneResult {
  base_url: string
  pages_cloned: number
  site_structure: Array<{ path: string; title: string }>
  intelligence_summary: string
  phones: string[]
  emails: string[]
  services_detected: string[]
  technology_stack: string[]
  cloned_at: string
}

// Extract phone numbers from text
function extractPhones(text: string): string[] {
  const re = new RegExp("(\\+?1?[-.\\s]?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4})", "g")
  return [...new Set(text.match(re) || [])].slice(0, 10)
}

// Extract emails from text
function extractEmails(text: string): string[] {
  const re = new RegExp("[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}", "g")
  return [...new Set(text.match(re) || [])].slice(0, 10)
}

// Detect tech stack from HTML
function detectStack(html: string): string[] {
  const checks: Array<[string, string]> = [
    ["_next/", "Next.js"], ["react", "React"], ["wp-content", "WordPress"],
    ["shopify", "Shopify"], ["wix", "Wix"], ["tailwind", "Tailwind CSS"],
    ["bootstrap", "Bootstrap"], ["jquery", "jQuery"],
    ["googletagmanager", "Google Tag Manager"], ["hubspot", "HubSpot"],
  ]
  return checks.filter(([k]) => html.toLowerCase().includes(k)).map(([, v]) => v)
}

// Extract links using indexOf-based parsing (no complex regex)
function extractLinks(html: string, baseUrl: string): ShadowResult["links"] {
  const links: ShadowResult["links"] = []
  let pos = 0
  const lower = html.toLowerCase()
  while (pos < html.length) {
    const idx = lower.indexOf("href=", pos)
    if (idx < 0) break
    pos = idx + 5
    const quote = html[pos]
    if (quote !== '"' && quote !== "'") continue
    pos++
    const end = html.indexOf(quote, pos)
    if (end < 0) continue
    const href = html.slice(pos, end).trim()
    pos = end + 1
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue
    const fullHref = href.startsWith("http") ? href : (href.startsWith("/") ? baseUrl + href : href)
    links.push({
      href: fullHref.slice(0, 200),
      text: "",
      type: href.startsWith("http") && !href.includes(new URL(baseUrl).hostname) ? "external" : "internal",
    })
    if (links.length >= 60) break
  }
  return links
}

// Extract headings using indexOf
function extractHeadings(html: string): string[] {
  const headings: string[] = []
  let pos = 0
  const lower = html.toLowerCase()
  for (const tag of ["<h1", "<h2", "<h3"]) {
    pos = 0
    while (pos < html.length) {
      const start = lower.indexOf(tag, pos)
      if (start < 0) break
      const close = lower.indexOf(">", start)
      if (close < 0) break
      const end = lower.indexOf("</" + tag.slice(1), close)
      if (end < 0) { pos = close + 1; continue }
      const text = html.slice(close + 1, end).replace(/<[^>]+>/g, "").trim()
      if (text && text.length < 200) headings.push(text)
      pos = end + 1
      if (headings.length >= 25) break
    }
  }
  return headings
}

// Core scraper — fetch + parse single URL
export async function shadowScrapeURL(url: string): Promise<ShadowResult> {
  const start = Date.now()
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    })
    const html = await res.text()
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 8000)

    // Extract title
    const titleStart = html.toLowerCase().indexOf("<title")
    const titleEnd = html.toLowerCase().indexOf("</title>")
    const title = titleStart >= 0 && titleEnd > titleStart
      ? html.slice(html.indexOf(">", titleStart) + 1, titleEnd).trim().slice(0, 200)
      : url

    // Extract meta description
    const descIdx = html.toLowerCase().indexOf('name="description"')
    const descAlt = html.toLowerCase().indexOf("name='description'")
    const descPos = descIdx >= 0 ? descIdx : descAlt
    let description = ""
    if (descPos >= 0) {
      const contentIdx = html.toLowerCase().indexOf("content=", descPos)
      if (contentIdx >= 0) {
        const q = html[contentIdx + 8]
        const end = html.indexOf(q, contentIdx + 9)
        if (end >= 0) description = html.slice(contentIdx + 9, end).trim().slice(0, 300)
      }
    }

    const baseUrl = new URL(url).origin

    return {
      url, title, description, visible_text: text,
      links: extractLinks(html, baseUrl),
      images: [],
      headings: extractHeadings(html),
      phones: extractPhones(text),
      emails: extractEmails(text),
      technology_stack: detectStack(html),
      load_time_ms: Date.now() - start,
      status_code: res.status,
    }
  } catch (e) {
    return {
      url, title: "", description: "", visible_text: "",
      links: [], images: [], headings: [], phones: [], emails: [],
      technology_stack: [], load_time_ms: Date.now() - start,
      status_code: 0, error: String(e),
    }
  }
}

// Parallel scraper — all URLs simultaneously
export async function shadowScrapeParallel(urls: string[], concurrency = 10): Promise<ShadowResult[]> {
  const results: ShadowResult[] = []
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(u => shadowScrapeURL(u)))
    results.push(...batchResults)
  }
  return results
}

// Full site clone — crawl entire site in parallel batches
export async function shadowCloneSite(baseUrl: string, maxPages = 15): Promise<ShadowCloneResult> {
  const visited = new Set<string>()
  const queue: string[] = [baseUrl]
  const structure: ShadowCloneResult["site_structure"] = []
  const allPhones: string[] = []
  const allEmails: string[] = []
  const allServices: string[] = []
  const allStack: string[] = []
  const serviceKeywords = ["service", "offer", "provide", "install", "coat", "epoxy", "floor", "polish", "concrete", "garage"]

  const origin = new URL(baseUrl).origin

  while (queue.length > 0 && visited.size < maxPages) {
    const batch = queue.splice(0, 5).filter(u => !visited.has(u))
    if (batch.length === 0) break
    batch.forEach(u => visited.add(u))

    const results = await shadowScrapeParallel(batch)
    for (const r of results) {
      if (r.error && r.status_code === 0) continue
      structure.push({ path: r.url.replace(origin, "") || "/", title: r.title })
      allPhones.push(...r.phones)
      allEmails.push(...r.emails)
      allStack.push(...r.technology_stack)
      for (const h of r.headings) {
        if (serviceKeywords.some(k => h.toLowerCase().includes(k))) allServices.push(h)
      }
      for (const link of r.links) {
        if (link.type === "internal" && !visited.has(link.href) && link.href.startsWith(origin)) {
          queue.push(link.href)
        }
      }
    }
  }

  return {
    base_url: baseUrl,
    pages_cloned: visited.size,
    site_structure: structure,
    intelligence_summary: `Cloned ${visited.size} pages | ${[...new Set(allPhones)].length} phones | ${[...new Set(allEmails)].length} emails | ${[...new Set(allServices)].length} services`,
    phones: [...new Set(allPhones)].slice(0, 5),
    emails: [...new Set(allEmails)].slice(0, 5),
    services_detected: [...new Set(allServices)].slice(0, 20),
    technology_stack: [...new Set(allStack)],
    cloned_at: new Date().toISOString(),
  }
}

// XPS competitor intelligence
export async function runCompetitorIntel(location = "Phoenix Arizona"): Promise<{ competitors: ShadowCloneResult[]; summary: string }> {
  const knownCompetitors = [
    "https://www.sunbeltepoxy.com",
    "https://www.phoenixepoxyfloors.com",
  ]
  const clones = await Promise.all(knownCompetitors.map(url => shadowCloneSite(url, 5)))
  const summary = clones.map(c => c.intelligence_summary).join(" | ")
  return { competitors: clones, summary }
}
