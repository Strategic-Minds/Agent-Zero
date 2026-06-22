/**
 * GHOST AGENT — Universal Site Clone & Intelligence Engine
 * 
 * Capabilities:
 * - Deep headless crawl (every page, asset, API, script)
 * - Reverse-engineer tech stack, CMS, payments, auth flows
 * - Extract all content, structure, data models
 * - Identify weakness: SEO, perf, UX, conversion, security
 * - Generate pixel-perfect Next.js clone with improvements
 * - Niche/profit opportunity analysis (any industry, any country)
 * - Auto-push reconstruction to GitHub + deploy to Vercel
 */

import { generateText, generateObject } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase'
import { remember } from '@/lib/memory'
import { logAction } from '@/lib/governance'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! })

export const GHOST_ID = 'ghost-agent'

// ─── SCHEMAS ────────────────────────────────────────────────────────────────

export const SiteIntelligenceSchema = z.object({
  url: z.string(),
  title: z.string(),
  description: z.string(),
  techStack: z.array(z.string()),
  cms: z.string().nullable(),
  ecommerce: z.string().nullable(),
  paymentProviders: z.array(z.string()),
  authSystem: z.string().nullable(),
  analytics: z.array(z.string()),
  adNetworks: z.array(z.string()),
  language: z.string(),
  country: z.string(),
  industry: z.string(),
  niche: z.string(),
  estimatedMonthlyTraffic: z.string(),
  estimatedRevenue: z.string(),
  monetizationModel: z.array(z.string()),
  pages: z.array(z.object({
    url: z.string(),
    title: z.string(),
    type: z.enum(['home', 'product', 'service', 'blog', 'landing', 'checkout', 'contact', 'about', 'pricing', 'faq', 'gallery', 'portfolio', 'testimonials', 'other']),
    wordCount: z.number(),
    hasForm: z.boolean(),
    hasCTA: z.boolean(),
  })),
  weaknesses: z.array(z.object({
    category: z.enum(['seo', 'performance', 'ux', 'conversion', 'security', 'content', 'mobile', 'accessibility']),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    issue: z.string(),
    fix: z.string(),
  })),
  strengths: z.array(z.string()),
  profitOpportunities: z.array(z.object({
    type: z.string(),
    description: z.string(),
    estimatedROI: z.string(),
    effort: z.enum(['low', 'medium', 'high']),
    priority: z.number(),
  })),
  competitorGaps: z.array(z.string()),
  reconstructionPlan: z.object({
    approach: z.enum(['perfect_clone', 'enhanced_clone', 'inspired_rebuild', 'niche_pivot']),
    framework: z.string(),
    estimatedPages: z.number(),
    keyFeaturesToAdd: z.array(z.string()),
    estimatedBuildHours: z.number(),
  }),
})

export type SiteIntelligence = z.infer<typeof SiteIntelligenceSchema>

// ─── CORE FETCH ENGINE ───────────────────────────────────────────────────────

async function fetchPageRaw(url: string): Promise<{
  html: string
  headers: Record<string, string>
  status: number
  loadTime: number
}> {
  const start = Date.now()
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      signal: AbortSignal.timeout(15000),
    })
    const html = await res.text()
    const headers: Record<string, string> = {}
    res.headers.forEach((v, k) => { headers[k] = v })
    return { html, headers, status: res.status, loadTime: Date.now() - start }
  } catch (e) {
    return { html: '', headers: {}, status: 0, loadTime: Date.now() - start }
  }
}

function extractLinks(html: string, baseUrl: string): string[] {
  const links: Set<string> = new Set()
  const base = new URL(baseUrl)
  
  // Extract href links
  const hrefMatches = html.matchAll(/href=["']([^"'#?]+)["']/gi)
  for (const match of hrefMatches) {
    try {
      const url = new URL(match[1], baseUrl)
      if (url.hostname === base.hostname) links.add(url.href.split('?')[0])
    } catch {}
  }
  
  // Extract sitemap references
  const sitemapMatch = html.match(/sitemap[^"']*\.xml/i)
  if (sitemapMatch) links.add(new URL(sitemapMatch[0], baseUrl).href)
  
  return [...links].slice(0, 50) // Cap at 50 internal links
}

function detectTechStack(html: string, headers: Record<string, string>): string[] {
  const stack: string[] = []
  const h = html.toLowerCase()
  const hdrs = JSON.stringify(headers).toLowerCase()
  
  // Frameworks
  if (h.includes('__next') || h.includes('_next/')) stack.push('Next.js')
  if (h.includes('nuxt') || h.includes('__nuxt')) stack.push('Nuxt.js')
  if (h.includes('gatsby')) stack.push('Gatsby')
  if (h.includes('wp-content') || h.includes('wp-includes')) stack.push('WordPress')
  if (h.includes('shopify')) stack.push('Shopify')
  if (h.includes('webflow')) stack.push('Webflow')
  if (h.includes('squarespace')) stack.push('Squarespace')
  if (h.includes('wix.com') || h.includes('wixsite')) stack.push('Wix')
  if (h.includes('react') || h.includes('reactdom')) stack.push('React')
  if (h.includes('vue') || h.includes('__vue')) stack.push('Vue.js')
  if (h.includes('angular')) stack.push('Angular')
  if (h.includes('svelte')) stack.push('Svelte')
  
  // Styling
  if (h.includes('tailwind')) stack.push('Tailwind CSS')
  if (h.includes('bootstrap')) stack.push('Bootstrap')
  if (h.includes('material-ui') || h.includes('mui')) stack.push('Material UI')
  
  // Analytics
  if (h.includes('google-analytics') || h.includes('gtag')) stack.push('Google Analytics')
  if (h.includes('segment.com')) stack.push('Segment')
  if (h.includes('hotjar')) stack.push('Hotjar')
  if (h.includes('mixpanel')) stack.push('Mixpanel')
  if (h.includes('clarity')) stack.push('Microsoft Clarity')
  if (h.includes('facebook.com/tr')) stack.push('Meta Pixel')
  
  // Payments
  if (h.includes('stripe')) stack.push('Stripe')
  if (h.includes('paypal')) stack.push('PayPal')
  if (h.includes('square')) stack.push('Square')
  if (h.includes('braintree')) stack.push('Braintree')
  
  // Auth
  if (h.includes('auth0')) stack.push('Auth0')
  if (h.includes('firebase')) stack.push('Firebase')
  if (h.includes('supabase')) stack.push('Supabase')
  if (h.includes('clerk')) stack.push('Clerk')
  
  // Hosting/CDN
  if (hdrs.includes('vercel')) stack.push('Vercel')
  if (hdrs.includes('cloudflare')) stack.push('Cloudflare')
  if (hdrs.includes('netlify')) stack.push('Netlify')
  if (hdrs.includes('x-powered-by')) {
    const powered = headers['x-powered-by'] || ''
    if (powered) stack.push(`Server: ${powered}`)
  }
  
  // Chat/Support
  if (h.includes('intercom')) stack.push('Intercom')
  if (h.includes('zendesk')) stack.push('Zendesk')
  if (h.includes('drift')) stack.push('Drift')
  if (h.includes('crisp')) stack.push('Crisp')
  
  return [...new Set(stack)]
}

function extractMetaData(html: string): {
  title: string
  description: string
  ogImage: string
  keywords: string
  schema: string
  lang: string
} {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                   html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)
  const ogImgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
  const kwMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i)
  const schemaMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)
  const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["']/i)
  
  return {
    title: titleMatch?.[1]?.trim() || '',
    description: descMatch?.[1]?.trim() || '',
    ogImage: ogImgMatch?.[1] || '',
    keywords: kwMatch?.[1] || '',
    schema: schemaMatch?.[1]?.trim() || '',
    lang: langMatch?.[1] || 'en',
  }
}

function extractText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000)
}

function detectForms(html: string): { hasForm: boolean; formTypes: string[] } {
  const forms = html.match(/<form[^>]*>/gi) || []
  const formTypes: string[] = []
  const h = html.toLowerCase()
  if (h.includes('subscribe') || h.includes('newsletter')) formTypes.push('newsletter')
  if (h.includes('contact') || h.includes('inquiry')) formTypes.push('contact')
  if (h.includes('checkout') || h.includes('payment')) formTypes.push('checkout')
  if (h.includes('login') || h.includes('sign in')) formTypes.push('login')
  if (h.includes('register') || h.includes('sign up')) formTypes.push('register')
  if (h.includes('quote') || h.includes('estimate')) formTypes.push('quote_request')
  return { hasForm: forms.length > 0, formTypes }
}

// ─── DEEP CRAWL ENGINE ───────────────────────────────────────────────────────

export async function deepCrawl(targetUrl: string, maxPages = 20): Promise<{
  pages: Array<{
    url: string
    html: string
    text: string
    meta: ReturnType<typeof extractMetaData>
    techStack: string[]
    headers: Record<string, string>
    status: number
    loadTime: number
    forms: ReturnType<typeof detectForms>
    links: string[]
    wordCount: number
  }>
  totalPages: number
  crawlTime: number
}> {
  const start = Date.now()
  const visited = new Set<string>()
  const queue = [targetUrl]
  const pages: Awaited<ReturnType<typeof deepCrawl>>['pages'] = []
  
  // Always try these paths
  const commonPaths = ['/about', '/services', '/products', '/pricing', '/contact', '/blog', '/faq', '/team', '/sitemap.xml', '/robots.txt']
  const base = new URL(targetUrl)
  for (const p of commonPaths) {
    queue.push(new URL(p, targetUrl).href)
  }
  
  while (queue.length > 0 && pages.length < maxPages) {
    const url = queue.shift()!
    if (visited.has(url)) continue
    visited.add(url)
    
    const { html, headers, status, loadTime } = await fetchPageRaw(url)
    if (!html || status === 0) continue
    
    const meta = extractMetaData(html)
    const techStack = detectTechStack(html, headers)
    const text = extractText(html)
    const forms = detectForms(html)
    const links = extractLinks(html, url)
    const wordCount = text.split(/\s+/).length
    
    pages.push({ url, html: html.slice(0, 5000), text: text.slice(0, 2000), meta, techStack, headers, status, loadTime, forms, links, wordCount })
    
    // Add new links to queue
    for (const link of links) {
      if (!visited.has(link) && link.includes(base.hostname)) {
        queue.push(link)
      }
    }
    
    await new Promise(r => setTimeout(r, 200)) // Polite crawl delay
  }
  
  return { pages, totalPages: pages.length, crawlTime: Date.now() - start }
}

// ─── AI INTELLIGENCE ENGINE ──────────────────────────────────────────────────

export async function analyzeWithAI(crawlData: Awaited<ReturnType<typeof deepCrawl>>, targetUrl: string): Promise<SiteIntelligence> {
  const allTechStack = [...new Set(crawlData.pages.flatMap(p => p.techStack))]
  const mainPage = crawlData.pages[0] || { meta: { title: '', description: '', lang: 'en' }, text: '', forms: { hasForm: false, formTypes: [] } }
  
  const siteContext = `
TARGET URL: ${targetUrl}
PAGES CRAWLED: ${crawlData.totalPages}
CRAWL TIME: ${crawlData.crawlTime}ms

DETECTED TECH STACK: ${allTechStack.join(', ') || 'Unknown'}

MAIN PAGE:
Title: ${mainPage.meta.title}
Description: ${mainPage.meta.description}
Language: ${mainPage.meta.lang}
Content: ${mainPage.text.slice(0, 2000)}

ALL PAGES:
${crawlData.pages.slice(0, 15).map(p => `
  URL: ${p.url}
  Title: ${p.meta.title}
  Words: ${p.wordCount}
  Load: ${p.loadTime}ms
  Status: ${p.status}
  Forms: ${p.forms.formTypes.join(', ') || 'none'}
`).join('\n')}

PAGE TITLES FOUND:
${crawlData.pages.map(p => `- ${p.url}: ${p.meta.title}`).join('\n')}
`

  const { object } = await generateObject({
    model: groq('llama-3.3-70b-versatile'),
    schema: SiteIntelligenceSchema,
    prompt: `You are a world-class web intelligence analyst and reverse engineer. 

Analyze this website deeply and produce a complete intelligence report.

${siteContext}

Provide:
1. Complete tech stack identification
2. Business model and monetization analysis
3. ALL weaknesses (SEO, performance, UX, conversion, security, content gaps)
4. ALL profit opportunities (new revenue streams, audience expansion, product gaps)
5. Competitor gap analysis
6. Exact reconstruction plan

Be extremely thorough. Identify every opportunity to make this site more profitable.
Think globally — consider international expansion, multilingual opportunities, new market segments.
The reconstruction approach should maximize revenue potential.`,
  })

  return object
}

// ─── CODE GENERATOR ──────────────────────────────────────────────────────────

export async function generateCloneCode(intelligence: SiteIntelligence, options: {
  approach: 'perfect_clone' | 'enhanced_clone' | 'inspired_rebuild' | 'niche_pivot'
  targetRepo?: string
  customInstructions?: string
}): Promise<{
  files: Array<{ path: string; content: string }>
  summary: string
}> {
  const { text: summary } = await generateText({
    model: groq('llama-3.3-70b-versatile'),
    prompt: `You are an expert Next.js engineer. Based on this site intelligence, generate a reconstruction plan.

SITE: ${intelligence.url}
INDUSTRY: ${intelligence.industry}
NICHE: ${intelligence.niche}
APPROACH: ${options.approach}
TECH STACK DETECTED: ${intelligence.techStack.join(', ')}
PAGES: ${intelligence.pages.length}
KEY FEATURES TO ADD: ${intelligence.reconstructionPlan.keyFeaturesToAdd.join(', ')}
WEAKNESSES TO FIX: ${intelligence.weaknesses.filter(w => w.severity === 'critical' || w.severity === 'high').map(w => w.issue).join(', ')}
PROFIT OPPORTUNITIES: ${intelligence.profitOpportunities.slice(0,3).map(p => p.description).join(', ')}
${options.customInstructions ? `CUSTOM INSTRUCTIONS: ${options.customInstructions}` : ''}

Write a detailed technical implementation summary covering:
1. File structure
2. Key components to build
3. Database schema
4. API routes needed
5. Revenue integrations to add
6. Performance optimizations
7. SEO strategy

Be specific and actionable.`,
    maxTokens: 2000,
  })

  // Generate the core page structure
  const { text: homePageCode } = await generateText({
    model: groq('llama-3.3-70b-versatile'),
    prompt: `Generate a complete Next.js 14 app/page.tsx for this site reconstruction.

SITE: ${intelligence.url} (${intelligence.industry} - ${intelligence.niche})
TITLE: ${intelligence.pages[0]?.title || intelligence.title}
APPROACH: ${options.approach}
KEY FEATURES: ${intelligence.reconstructionPlan.keyFeaturesToAdd.slice(0,5).join(', ')}
MONETIZATION: ${intelligence.monetizationModel.join(', ')}

Generate production-ready React/TypeScript code using Tailwind CSS.
Include: hero section, value proposition, key features, social proof, CTA, footer.
Make it conversion-optimized. Fix all UX weaknesses.
Output ONLY the code, no explanation.`,
    maxTokens: 3000,
  })

  const files = [
    {
      path: 'clone-output/page.tsx',
      content: homePageCode,
    },
    {
      path: 'clone-output/INTELLIGENCE_REPORT.md',
      content: `# Site Intelligence Report
## ${intelligence.url}
**Generated:** ${new Date().toISOString()}
**Industry:** ${intelligence.industry}
**Niche:** ${intelligence.niche}
**Country:** ${intelligence.country}
**Language:** ${intelligence.language}

## Tech Stack
${intelligence.techStack.map(t => `- ${t}`).join('\n')}

## Estimated Traffic
${intelligence.estimatedMonthlyTraffic}

## Estimated Revenue
${intelligence.estimatedRevenue}

## Monetization Models
${intelligence.monetizationModel.map(m => `- ${m}`).join('\n')}

## 🔴 Critical Weaknesses
${intelligence.weaknesses.filter(w => w.severity === 'critical').map(w => `### ${w.category.toUpperCase()}: ${w.issue}\n**Fix:** ${w.fix}`).join('\n\n')}

## 🟠 High Severity Weaknesses
${intelligence.weaknesses.filter(w => w.severity === 'high').map(w => `### ${w.category.toUpperCase()}: ${w.issue}\n**Fix:** ${w.fix}`).join('\n\n')}

## 🟡 Medium Weaknesses
${intelligence.weaknesses.filter(w => w.severity === 'medium').map(w => `- **${w.category}:** ${w.issue}`).join('\n')}

## 💪 Strengths
${intelligence.strengths.map(s => `- ${s}`).join('\n')}

## 💰 Profit Opportunities
${intelligence.profitOpportunities.sort((a,b) => a.priority - b.priority).map(o => `### ${o.type} (${o.effort} effort)
${o.description}
**Estimated ROI:** ${o.estimatedROI}`).join('\n\n')}

## Competitor Gaps
${intelligence.competitorGaps.map(g => `- ${g}`).join('\n')}

## Reconstruction Plan
**Approach:** ${intelligence.reconstructionPlan.approach}
**Framework:** ${intelligence.reconstructionPlan.framework}
**Estimated Pages:** ${intelligence.reconstructionPlan.estimatedPages}
**Build Time:** ~${intelligence.reconstructionPlan.estimatedBuildHours} hours

### Key Features to Add
${intelligence.reconstructionPlan.keyFeaturesToAdd.map(f => `- ${f}`).join('\n')}

## Implementation Summary
${summary}
`,
    },
  ]

  return { files, summary }
}

// ─── MAIN GHOST RUN ──────────────────────────────────────────────────────────

export async function runGhost(targetUrl: string, options: {
  maxPages?: number
  approach?: 'perfect_clone' | 'enhanced_clone' | 'inspired_rebuild' | 'niche_pivot'
  pushToGithub?: boolean
  customInstructions?: string
} = {}): Promise<{
  success: boolean
  intelligence: SiteIntelligence
  files: Array<{ path: string; content: string }>
  summary: string
  crawlStats: { pages: number; crawlTime: number }
}> {
  const { maxPages = 15, approach = 'enhanced_clone', customInstructions } = options

  await logAction({ agent_id: GHOST_ID, action: 'ghost_run_start', level: 3, status: 'allowed', details: { targetUrl, maxPages, approach } })

  // 1. Deep crawl
  const crawlData = await deepCrawl(targetUrl, maxPages)
  
  // 2. AI analysis
  const intelligence = await analyzeWithAI(crawlData, targetUrl)
  
  // 3. Generate clone code
  const { files, summary } = await generateCloneCode(intelligence, { approach, customInstructions })
  
  // 4. Store in Supabase
  try {
    const db = getSupabaseAdmin()
    await db.from('ghost_runs' as any).insert({
      target_url: targetUrl,
      approach,
      industry: intelligence.industry,
      niche: intelligence.niche,
      pages_crawled: crawlData.totalPages,
      weaknesses_found: intelligence.weaknesses.length,
      opportunities_found: intelligence.profitOpportunities.length,
      intelligence_json: intelligence,
      status: 'complete',
    })
  } catch (_) {}

  await remember({
    agent_id: GHOST_ID,
    memory_type: 'episodic',
    key: `ghost_run_${new Date().toISOString().split('T')[0]}`,
    value: { targetUrl, industry: intelligence.industry, niche: intelligence.niche, pages: crawlData.totalPages, opportunities: intelligence.profitOpportunities.length },
  })

  return {
    success: true,
    intelligence,
    files,
    summary,
    crawlStats: { pages: crawlData.totalPages, crawlTime: crawlData.crawlTime },
  }
}

// ─── NICHE FINDER ────────────────────────────────────────────────────────────

export async function findProfitableNiches(params: {
  industry?: string
  country?: string
  budget?: string
  skills?: string
  existingSite?: string
}): Promise<{
  niches: Array<{
    name: string
    description: string
    marketSize: string
    competition: string
    entryBarrier: string
    monetization: string[]
    estimatedMonthlyRevenue: string
    timeToFirstRevenue: string
    topCompetitors: string[]
    uniqueAngle: string
    actionPlan: string[]
  }>
}> {
  const { object } = await generateObject({
    model: groq('llama-3.3-70b-versatile'),
    schema: z.object({
      niches: z.array(z.object({
        name: z.string(),
        description: z.string(),
        marketSize: z.string(),
        competition: z.enum(['low', 'medium', 'high']),
        entryBarrier: z.enum(['low', 'medium', 'high']),
        monetization: z.array(z.string()),
        estimatedMonthlyRevenue: z.string(),
        timeToFirstRevenue: z.string(),
        topCompetitors: z.array(z.string()),
        uniqueAngle: z.string(),
        actionPlan: z.array(z.string()),
      })),
    }),
    prompt: `You are a top-tier business strategist and niche market analyst with expertise in digital business models worldwide.

Find the 10 most profitable niches right now based on:
Industry: ${params.industry || 'any'}
Country/Region: ${params.country || 'global'}
Budget: ${params.budget || 'any'}
Skills/Background: ${params.skills || 'any'}
Existing Site Context: ${params.existingSite || 'none'}

Requirements:
- Real, specific niches (not generic categories)
- Mix of digital products, services, SaaS, affiliate, ecommerce
- Include emerging/untapped niches
- Consider global markets, non-English markets
- Focus on high-margin, scalable models
- Include at least 3 with low competition

Return exactly 10 niches with complete analysis.`,
    maxTokens: 4000,
  })

  return object
}
