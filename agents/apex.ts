/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  APEX AGENT — Ceiling-Level Autonomous Code Intelligence Engine  ║
 * ║                                                                   ║
 * ║  Skills: Clone · Rebuild · Heal · Harden · Test · Optimize       ║
 * ║  Mode:   Fully autonomous — no human prompting required           ║
 * ║  Output: Production-ready Next.js, enterprise docs, test reports  ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * WORKFLOW (auto-executes in sequence):
 *  1. DISCOVER  — Find top 3 sites/systems in target niche worldwide
 *  2. CRAWL     — Deep parallel multi-page inhalation (headless)
 *  3. ANALYZE   — Reverse-engineer every layer (tech, UX, business, code)
 *  4. RANK      — Score sites by quality, identify the best patterns
 *  5. SANDBOX   — Generate complete Next.js clone in /clone-output
 *  6. TEST      — Autonomous frontend + backend + UX testing
 *  7. HEAL      — Auto-fix all failures, harden, optimize
 *  8. DOCUMENT  — Generate enterprise intelligence files + Google Docs
 *  9. DEPLOY    — Push to GitHub → auto-deploy to Vercel
 * 10. REPORT    — WhatsApp briefing to Jeremy
 */

import { generateText, generateObject } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase'
import { logAction, remember, recall } from '@/lib/memory'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! })
// Model rotation pool — used round-robin to avoid TPM limits
const MODELS = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'gemma2-9b-it']
let modelIdx = 0
function getModel() {
  const m = groq(MODELS[modelIdx % MODELS.length])
  modelIdx++
  return m
}
const model = groq('llama-3.3-70b-versatile')

// Retry with backoff on rate limit errors
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3, baseDelay = 5000): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      const isRateLimit = msg.includes('Rate limit') || msg.includes('429') || msg.includes('TPM')
      if (isRateLimit && attempt < maxAttempts) {
        const delay = baseDelay * attempt
        await new Promise(r => setTimeout(r, delay))
        modelIdx++ // rotate model
        continue
      }
      throw e
    }
  }
  throw new Error('Max retry attempts exceeded')
}

export const APEX_ID = 'apex-agent'
export const APEX_VERSION = '2.0.0'

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ApexTarget {
  url?: string
  niche?: string
  industry?: string
  country?: string
  customInstructions?: string
  mode: 'clone' | 'enhance' | 'discover_and_clone' | 'audit' | 'niche_hunt'
  maxSites?: number
  maxPagesPerSite?: number
  autoDeploy?: boolean
  autoTest?: boolean
  autoHeal?: boolean
  generateDocs?: boolean
}

export interface PageIntelligence {
  url: string
  status: number
  loadTimeMs: number
  title: string
  description: string
  h1s: string[]
  ctas: string[]
  forms: string[]
  images: number
  videos: number
  wordCount: number
  internalLinks: string[]
  externalLinks: string[]
  techSignals: string[]
  schemaTypes: string[]
  hasPaywall: boolean
  hasPricing: boolean
  hasCheckout: boolean
  hasAuth: boolean
  hasBlog: boolean
  hasDashboard: boolean
  mobileViewport: boolean
  accessibilityIssues: string[]
  seoIssues: string[]
  perfIssues: string[]
  rawHtmlSample: string
}

export interface SiteBlueprint {
  url: string
  domain: string
  overallScore: number // 0-100
  techStack: string[]
  framework: string
  hostingProvider: string
  cdnProvider: string
  cmsType: string | null
  ecommerceType: string | null
  authSystem: string | null
  paymentProviders: string[]
  analyticsTools: string[]
  chatTools: string[]
  industry: string
  niche: string
  targetAudience: string
  businessModel: string[]
  estimatedMRR: string
  estimatedTraffic: string
  seoStrength: number // 0-10
  uxScore: number // 0-10
  perfScore: number // 0-10
  conversionScore: number // 0-10
  mobileScore: number // 0-10
  securityScore: number // 0-10
  pages: PageIntelligence[]
  siteWideWeaknesses: Array<{
    category: string
    severity: 'critical' | 'high' | 'medium' | 'low'
    description: string
    fix: string
    effort: 'quick' | 'medium' | 'sprint'
    estimatedImpact: string
  }>
  strengths: string[]
  missingFeatures: string[]
  profitLeaks: string[]
  growthOpportunities: string[]
  competitorAdvantages: string[]
  reconstructionStrategy: {
    approach: string
    corePages: string[]
    keyComponents: string[]
    databaseSchema: string[]
    apiRoutes: string[]
    revenueAdditions: string[]
    techChoices: string
    estimatedHours: number
    priorityOrder: string[]
  }
}

export interface TestResult {
  category: 'navigation' | 'forms' | 'performance' | 'seo' | 'accessibility' | 'security' | 'api' | 'mobile'
  test: string
  status: 'pass' | 'fail' | 'warning'
  detail: string
  fix?: string
  autoFixed?: boolean
}

export interface ApexRun {
  id: string
  target: ApexTarget
  status: 'running' | 'complete' | 'failed'
  phase: string
  startedAt: string
  completedAt?: string
  discoveredSites: string[]
  blueprints: SiteBlueprint[]
  bestSite: string
  generatedFiles: Array<{ path: string; lines: number; language: string }>
  testResults: TestResult[]
  healedIssues: number
  docUrl?: string
  deployUrl?: string
  summary: string
  whatsappBriefing: string
}

// ─── PHASE 1: DISCOVER TOP SITES ─────────────────────────────────────────────

export async function discoverTopSites(params: {
  niche: string
  industry: string
  country?: string
  maxSites?: number
}): Promise<string[]> {
  const { object } = await withRetry(() => generateObject({
    model: getModel(),
    schema: z.object({
      sites: z.array(z.object({
        url: z.string(),
        reason: z.string(),
        rank: z.number(),
        traffic: z.string(),
        revenueModel: z.string(),
      })).min(3).max(10),
    }),
    prompt: `You are a world-class market research analyst with access to Similarweb, Ahrefs, and SEMrush data.

Find the TOP 3-5 real, live websites that are the absolute BEST examples in this niche.
These must be REAL URLs that actually exist and are live right now.

NICHE: ${params.niche}
INDUSTRY: ${params.industry}
COUNTRY/MARKET: ${params.country || 'Global / English-speaking'}
GOAL: Find sites with the BEST design, UX, conversion, and business model to reverse-engineer.

Criteria:
- Must be real, live URLs
- Prefer sites with strong SEO presence
- Look for sites with clear monetization
- Prioritize sites that are industry leaders OR top-performing challengers
- Include at least 1 international/non-US site if applicable
- Focus on sites that represent CEILING-LEVEL quality for this niche

Return exactly 3-5 sites. Real URLs only.`,
    maxTokens: 1000,
  }))

  await logAction({
    agent_id: APEX_ID,
    action: 'discover_sites',
    level: 1,
    status: 'allowed',
    details: { niche: params.niche, found: object.sites.length },
  })

  return object.sites
    .sort((a, b) => a.rank - b.rank)
    .slice(0, params.maxSites || 3)
    .map(s => s.url)
}

// ─── PHASE 2: DEEP PARALLEL CRAWL ────────────────────────────────────────────

async function fetchPage(url: string, timeout = 12000): Promise<{
  html: string
  headers: Record<string, string>
  status: number
  ms: number
}> {
  const t = Date.now()
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(timeout),
      redirect: 'follow',
    })
    const html = await res.text()
    const headers: Record<string, string> = {}
    res.headers.forEach((v, k) => { headers[k] = v })
    return { html, headers, status: res.status, ms: Date.now() - t }
  } catch {
    return { html: '', headers: {}, status: 0, ms: Date.now() - t }
  }
}

function extractPageIntelligence(url: string, html: string, headers: Record<string, string>, status: number, ms: number): PageIntelligence {
  const h = html.toLowerCase()
  
  // Extract text content
  const textContent = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Meta extraction
  const title = html.match(/<title[^>]*>([^<]+)/i)?.[1]?.trim() || ''
  const desc = html.match(/name=["']description["'][^>]*content=["']([^"']+)/i)?.[1]?.trim() ||
               html.match(/content=["']([^"']+)["'][^>]*name=["']description["']/i)?.[1]?.trim() || ''
  
  // H1s
  const h1s = [...html.matchAll(/<h1[^>]*>([^<]+)/gi)].map(m => m[1].trim()).slice(0, 5)
  
  // CTAs (buttons and prominent links)
  const ctaPatterns = html.matchAll(/<(?:button|a)[^>]*>([^<]{3,50})<\/(?:button|a)>/gi)
  const ctas = [...ctaPatterns]
    .map(m => m[1].trim())
    .filter(t => /get|start|try|join|sign|buy|order|book|contact|free|now|demo|quote/i.test(t))
    .slice(0, 10)

  // Forms
  const formPatterns = html.matchAll(/<form[^>]*(?:action|id|name|class)=["']([^"']+)/gi)
  const forms = [...formPatterns].map(m => m[1]).slice(0, 10)

  // Links
  const base = new URL(url)
  const allLinks = [...html.matchAll(/href=["']([^"'#]+)["']/gi)]
    .map(m => { try { return new URL(m[1], url).href } catch { return null } })
    .filter(Boolean) as string[]
  
  const internalLinks = [...new Set(allLinks.filter(l => new URL(l).hostname === base.hostname))].slice(0, 30)
  const externalLinks = [...new Set(allLinks.filter(l => new URL(l).hostname !== base.hostname))].slice(0, 20)

  // Tech signals
  const techSignals: string[] = []
  if (h.includes('__next') || h.includes('_next/')) techSignals.push('Next.js')
  if (h.includes('wp-content')) techSignals.push('WordPress')
  if (h.includes('shopify')) techSignals.push('Shopify')
  if (h.includes('webflow')) techSignals.push('Webflow')
  if (h.includes('react') && !h.includes('react native')) techSignals.push('React')
  if (h.includes('vue.js') || h.includes('__vue')) techSignals.push('Vue.js')
  if (h.includes('angular')) techSignals.push('Angular')
  if (h.includes('tailwind')) techSignals.push('TailwindCSS')
  if (h.includes('bootstrap')) techSignals.push('Bootstrap')
  if (h.includes('stripe')) techSignals.push('Stripe')
  if (h.includes('paypal')) techSignals.push('PayPal')
  if (h.includes('gtag') || h.includes('google-analytics')) techSignals.push('GA4')
  if (h.includes('facebook.com/tr')) techSignals.push('Meta Pixel')
  if (h.includes('intercom')) techSignals.push('Intercom')
  if (h.includes('hotjar')) techSignals.push('Hotjar')
  if (h.includes('drift')) techSignals.push('Drift')
  if (h.includes('auth0')) techSignals.push('Auth0')
  if (h.includes('firebase')) techSignals.push('Firebase')
  if (h.includes('supabase')) techSignals.push('Supabase')
  if (headers['x-powered-by']) techSignals.push(`Powered:${headers['x-powered-by']}`)
  if (headers['server']) techSignals.push(`Server:${headers['server']}`)
  if (JSON.stringify(headers).includes('vercel')) techSignals.push('Vercel')
  if (JSON.stringify(headers).includes('cloudflare')) techSignals.push('Cloudflare')

  // Schema types
  const schemaMatches = [...html.matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map(m => m[1])
  const schemaTypes = [...new Set(schemaMatches)].slice(0, 10)

  // Feature detection
  const hasPaywall = h.includes('paywall') || h.includes('subscribe to read') || h.includes('members only')
  const hasPricing = h.includes('pricing') || h.includes('/pricing') || h.includes('per month') || h.includes('$/mo')
  const hasCheckout = h.includes('checkout') || h.includes('add to cart') || h.includes('buy now')
  const hasAuth = h.includes('sign in') || h.includes('log in') || h.includes('login') || h.includes('dashboard')
  const hasBlog = h.includes('/blog') || h.includes('article') || h.includes('post')
  const hasDashboard = h.includes('dashboard') || h.includes('portal') || h.includes('account')
  const mobileViewport = h.includes('viewport') && h.includes('width=device-width')

  // Issue detection
  const accessibilityIssues: string[] = []
  if (!h.includes('alt=') && h.includes('<img')) accessibilityIssues.push('Images missing alt attributes')
  if (!h.includes('aria-label') && !h.includes('aria-describedby')) accessibilityIssues.push('Missing ARIA labels')
  if (!h.includes('<label')) accessibilityIssues.push('Forms may lack labels')

  const seoIssues: string[] = []
  if (!title) seoIssues.push('Missing title tag')
  if (!desc) seoIssues.push('Missing meta description')
  if (h1s.length === 0) seoIssues.push('No H1 found')
  if (h1s.length > 1) seoIssues.push(`Multiple H1s (${h1s.length})`)
  if (!h.includes('canonical')) seoIssues.push('No canonical URL')
  if (!h.includes('og:title')) seoIssues.push('Missing Open Graph tags')

  const perfIssues: string[] = []
  if (ms > 3000) perfIssues.push(`Slow TTFB: ${ms}ms`)
  if ((html.match(/<script/gi) || []).length > 20) perfIssues.push('Script overload (>20 scripts)')
  if (!h.includes('loading="lazy"') && h.includes('<img')) perfIssues.push('Images not lazy-loaded')
  if (!headers['cache-control']) perfIssues.push('No cache-control headers')

  return {
    url, status, loadTimeMs: ms, title, description: desc, h1s, ctas, forms,
    images: (html.match(/<img/gi) || []).length,
    videos: (html.match(/<video|youtube\.com|vimeo\.com/gi) || []).length,
    wordCount: textContent.split(/\s+/).filter(Boolean).length,
    internalLinks, externalLinks, techSignals, schemaTypes,
    hasPaywall, hasPricing, hasCheckout, hasAuth, hasBlog, hasDashboard, mobileViewport,
    accessibilityIssues, seoIssues, perfIssues,
    rawHtmlSample: html.slice(0, 3000),
  }
}

export async function deepCrawlSite(baseUrl: string, maxPages = 20): Promise<PageIntelligence[]> {
  const visited = new Set<string>()
  const queue: string[] = [baseUrl]
  const pages: PageIntelligence[] = []
  const base = new URL(baseUrl)

  // Inject priority paths
  const priorityPaths = [
    '/', '/about', '/pricing', '/features', '/services', '/products',
    '/blog', '/contact', '/faq', '/team', '/careers', '/docs',
    '/demo', '/signup', '/login', '/dashboard', '/api', '/sitemap.xml',
  ]
  for (const p of priorityPaths) {
    const u = new URL(p, baseUrl).href
    if (!queue.includes(u)) queue.push(u)
  }

  // Parallel fetch — process in batches of 5
  while (queue.length > 0 && pages.length < maxPages) {
    const batch = queue.splice(0, 5).filter(u => !visited.has(u))
    if (!batch.length) continue
    batch.forEach(u => visited.add(u))

    const results = await Promise.allSettled(
      batch.map(url => fetchPage(url).then(r => ({ url, ...r })))
    )

    for (const result of results) {
      if (result.status !== 'fulfilled') continue
      const { url, html, headers, status, ms } = result.value
      if (!html || status === 0) continue

      const intel = extractPageIntelligence(url, html, headers, status, ms)
      pages.push(intel)

      // Discover more internal links
      for (const link of intel.internalLinks) {
        if (!visited.has(link) && new URL(link).hostname === base.hostname) {
          queue.push(link)
        }
      }
    }

    await new Promise(r => setTimeout(r, 150)) // Polite delay between batches
  }

  return pages
}

// ─── PHASE 3: AI BLUEPRINT GENERATION ────────────────────────────────────────

export async function generateBlueprint(url: string, pages: PageIntelligence[]): Promise<SiteBlueprint> {
  const allTech = [...new Set(pages.flatMap(p => p.techSignals))]
  const mainPage = pages[0]
  
  const context = `
SITE: ${url}
PAGES ANALYZED: ${pages.length}
AVG LOAD TIME: ${Math.round(pages.reduce((a, p) => a + p.loadTimeMs, 0) / Math.max(pages.length, 1))}ms

TECH SIGNALS: ${allTech.join(', ')}
MAIN PAGE TITLE: ${mainPage?.title || 'Unknown'}
MAIN PAGE DESC: ${mainPage?.description || 'Unknown'}
MAIN PAGE H1s: ${mainPage?.h1s?.join(' | ') || 'None'}
MAIN PAGE CTAs: ${mainPage?.ctas?.join(' | ') || 'None'}

PAGES FOUND:
${pages.map(p => `  [${p.status}/${p.loadTimeMs}ms] ${p.url}
    Title: ${p.title}
    Words: ${p.wordCount} | Images: ${p.images} | CTAs: ${p.ctas.length}
    Features: ${[p.hasAuth && 'auth', p.hasPricing && 'pricing', p.hasCheckout && 'checkout', p.hasDashboard && 'dashboard'].filter(Boolean).join(', ') || 'none'}
    SEO Issues: ${p.seoIssues.join(', ') || 'none'}
    Perf Issues: ${p.perfIssues.join(', ') || 'none'}`).join('\n')}

SCHEMA TYPES FOUND: ${[...new Set(pages.flatMap(p => p.schemaTypes))].join(', ') || 'none'}
ALL CTAs FOUND: ${[...new Set(pages.flatMap(p => p.ctas))].join(' | ').slice(0, 500)}
`

  const { object } = await generateObject({
    model,
    schema: z.object({
      overallScore: z.number().min(0).max(100),
      framework: z.string(),
      hostingProvider: z.string(),
      cdnProvider: z.string(),
      cmsType: z.string().nullable(),
      ecommerceType: z.string().nullable(),
      authSystem: z.string().nullable(),
      paymentProviders: z.array(z.string()),
      analyticsTools: z.array(z.string()),
      chatTools: z.array(z.string()),
      industry: z.string(),
      niche: z.string(),
      targetAudience: z.string(),
      businessModel: z.array(z.string()),
      estimatedMRR: z.string(),
      estimatedTraffic: z.string(),
      seoStrength: z.number().min(0).max(10),
      uxScore: z.number().min(0).max(10),
      perfScore: z.number().min(0).max(10),
      conversionScore: z.number().min(0).max(10),
      mobileScore: z.number().min(0).max(10),
      securityScore: z.number().min(0).max(10),
      siteWideWeaknesses: z.array(z.object({
        category: z.string(),
        severity: z.enum(['critical', 'high', 'medium', 'low']),
        description: z.string(),
        fix: z.string(),
        effort: z.enum(['quick', 'medium', 'sprint']),
        estimatedImpact: z.string(),
      })),
      strengths: z.array(z.string()),
      missingFeatures: z.array(z.string()),
      profitLeaks: z.array(z.string()),
      growthOpportunities: z.array(z.string()),
      competitorAdvantages: z.array(z.string()),
      reconstructionStrategy: z.object({
        approach: z.string(),
        corePages: z.array(z.string()),
        keyComponents: z.array(z.string()),
        databaseSchema: z.array(z.string()),
        apiRoutes: z.array(z.string()),
        revenueAdditions: z.array(z.string()),
        techChoices: z.string(),
        estimatedHours: z.number(),
        priorityOrder: z.array(z.string()),
      }),
    }),
    prompt: `You are a ceiling-level full-stack architect, business strategist, and UX expert.
    
Analyze this website data and produce the most comprehensive technical + business blueprint possible.

${context}

Be extremely specific. Identify EVERY weakness, opportunity, and architectural decision.
Think like you're going to rebuild this site and make it 10x better.
Rate scores honestly — most sites have real weaknesses.`,
    maxTokens: 3000,
  }))

  return {
    url,
    domain: new URL(url).hostname,
    techStack: allTech,
    pages,
    ...object,
  }
}

// ─── PHASE 4: RANK + SELECT BEST ─────────────────────────────────────────────

export function rankBlueprints(blueprints: SiteBlueprint[]): SiteBlueprint[] {
  return blueprints.sort((a, b) => {
    const scoreA = a.overallScore + a.seoStrength * 3 + a.conversionScore * 4 + a.uxScore * 2
    const scoreB = b.overallScore + b.seoStrength * 3 + b.conversionScore * 4 + b.uxScore * 2
    return scoreB - scoreA
  })
}

// ─── PHASE 5: CODE GENERATION ────────────────────────────────────────────────

export async function generateCloneFiles(
  blueprints: SiteBlueprint[],
  mode: 'perfect_clone' | 'enhanced_clone' | 'inspired_rebuild',
  customInstructions?: string
): Promise<Array<{ path: string; content: string; language: string }>> {
  const best = blueprints[0]
  const files: Array<{ path: string; content: string; language: string }> = []

  const context = `
PRIMARY SITE: ${best.url}
INDUSTRY: ${best.industry} | NICHE: ${best.niche}
MODE: ${mode}
TECH TARGET: Next.js 14 + TypeScript + Tailwind CSS + Supabase
AUDIENCE: ${best.targetAudience}
BUSINESS MODEL: ${best.businessModel.join(', ')}
CORE PAGES: ${best.reconstructionStrategy.corePages.join(', ')}
FEATURES TO ADD: ${best.reconstructionStrategy.revenueAdditions.join(', ')}
WEAKNESSES TO FIX: ${best.siteWideWeaknesses.filter(w => w.severity === 'critical' || w.severity === 'high').map(w => w.fix).join('; ')}
${customInstructions ? `CUSTOM INSTRUCTIONS: ${customInstructions}` : ''}

SCORES TO BEAT:
- SEO: ${best.seoStrength}/10 → target 9+
- UX: ${best.uxScore}/10 → target 9+
- Performance: ${best.perfScore}/10 → target 9+
- Conversion: ${best.conversionScore}/10 → target 9+
`

  // Generate: Home page
  const { text: homePage } = await generateText({
    model,
    prompt: `Generate a complete, production-ready Next.js 14 app/page.tsx.

${context}

Requirements:
- TypeScript with proper types
- Tailwind CSS for all styling (no inline styles)
- Mobile-first responsive design
- SEO-optimized (proper meta, semantic HTML, Schema.org JSON-LD)
- Conversion-optimized hero with clear value proposition
- Social proof section (testimonials/logos)
- Features/benefits section
- CTA above and below fold
- Footer with full navigation
- Accessibility: ARIA labels, alt text, semantic HTML
- Performance: lazy loading, next/image, no layout shift

Output ONLY valid TypeScript/TSX code. No explanation.`,
    maxTokens: 3500,
  })
  files.push({ path: 'clone-output/app/page.tsx', content: homePage, language: 'tsx' })

  // Generate: Layout
  const { text: layout } = await generateText({
    model,
    prompt: `Generate app/layout.tsx for: ${best.url} (${best.industry} - ${best.niche})

Include:
- Complete <head> with SEO meta tags, Open Graph, Twitter cards
- Google Fonts import (match original font style: ${best.techStack.includes('Bootstrap') ? 'clean sans-serif' : 'modern'})
- Navbar component with logo + navigation links + CTA button
- Footer component
- Mobile hamburger menu support
- TypeScript + Tailwind

Output ONLY valid TypeScript/TSX code.`,
    maxTokens: 2500,
  })
  files.push({ path: 'clone-output/app/layout.tsx', content: layout, language: 'tsx' })

  // Generate: API route (contact/lead capture)
  const { text: apiRoute } = await generateText({
    model,
    prompt: `Generate app/api/contact/route.ts — a production-ready contact/lead capture API.

For site: ${best.url} (${best.niche})
Include: validation, rate limiting logic, email response structure, Supabase insert, TypeScript.
Output ONLY valid TypeScript code.`,
    maxTokens: 1500,
  })
  files.push({ path: 'clone-output/app/api/contact/route.ts', content: apiRoute, language: 'ts' })

  // Generate: Tailwind config
  const { text: tailwindConfig } = await generateText({
    model,
    prompt: `Generate tailwind.config.ts for the ${best.niche} site clone.
Extract the color palette and design system from these site details:
Tech: ${best.techStack.join(', ')}
Industry: ${best.industry}
Business Model: ${best.businessModel.join(', ')}

Include: custom colors, fonts, animations, shadows that match a premium ${best.industry} site.
Output ONLY valid TypeScript/JS config code.`,
    maxTokens: 800,
  })
  files.push({ path: 'clone-output/tailwind.config.ts', content: tailwindConfig, language: 'ts' })

  // Generate: types.ts
  const { text: types } = await generateText({
    model,
    prompt: `Generate types/index.ts for ${best.niche} site.
Database schema tables: ${best.reconstructionStrategy.databaseSchema.join(', ')}
Include all TypeScript interfaces and types needed.
Output ONLY TypeScript type definitions.`,
    maxTokens: 1000,
  })
  files.push({ path: 'clone-output/types/index.ts', content: types, language: 'ts' })

  // Generate: Supabase schema SQL
  const { text: schema } = await generateText({
    model,
    prompt: `Generate complete Supabase PostgreSQL schema for: ${best.niche} site.
Tables needed: ${best.reconstructionStrategy.databaseSchema.join(', ')}
Business model: ${best.businessModel.join(', ')}
Include: CREATE TABLE, indexes, RLS policies, triggers for updated_at.
Output ONLY valid SQL.`,
    maxTokens: 2000,
  })
  files.push({ path: 'clone-output/supabase/schema.sql', content: schema, language: 'sql' })

  return files
}

// ─── PHASE 6: AUTONOMOUS TESTING ─────────────────────────────────────────────

export async function autonomousTest(files: Array<{ path: string; content: string; language: string }>): Promise<TestResult[]> {
  const results: TestResult[] = []

  for (const file of files) {
    const { object } = await generateObject({
      model,
      schema: z.object({
        tests: z.array(z.object({
          category: z.enum(['navigation', 'forms', 'performance', 'seo', 'accessibility', 'security', 'api', 'mobile']),
          test: z.string(),
          status: z.enum(['pass', 'fail', 'warning']),
          detail: z.string(),
          fix: z.string().optional(),
        })),
      }),
      prompt: `You are a senior QA engineer and security auditor. Analyze this code file and run comprehensive tests.

FILE: ${file.path}
LANGUAGE: ${file.language}
CODE:
\`\`\`
${file.content.slice(0, 4000)}
\`\`\`

Run these test categories:
1. Navigation — are links valid, do routes exist, are CTAs functional
2. Forms — validation, CSRF protection, error states, success states
3. Performance — render blocking, bundle size, lazy loading, image optimization
4. SEO — meta tags, semantic HTML, schema markup, canonical URLs
5. Accessibility — ARIA labels, keyboard navigation, color contrast, alt text
6. Security — XSS vectors, injection points, exposed secrets, CORS
7. API — input validation, error handling, rate limiting, auth checks
8. Mobile — viewport meta, touch targets, responsive breakpoints

Be specific about what passes and what fails. For failures, provide exact fix.`,
      maxTokens: 2000,
    })

    results.push(...object.tests)
  }

  return results
}

// ─── PHASE 7: AUTO-HEAL ───────────────────────────────────────────────────────

export async function autoHeal(
  files: Array<{ path: string; content: string; language: string }>,
  testResults: TestResult[]
): Promise<{ files: Array<{ path: string; content: string; language: string }>; healed: number }> {
  const failures = testResults.filter(t => t.status === 'fail')
  if (!failures.length) return { files, healed: 0 }

  let healed = 0
  const healedFiles = [...files]

  // Group failures by file
  const failuresByFile: Record<string, TestResult[]> = {}
  for (const f of failures) {
    const fileHint = f.category === 'api' ? 'api/contact' : 
                     f.category === 'seo' ? 'app/page' :
                     f.category === 'security' ? 'app/api' : 'app/page'
    if (!failuresByFile[fileHint]) failuresByFile[fileHint] = []
    failuresByFile[fileHint].push(f)
  }

  for (let i = 0; i < healedFiles.length; i++) {
    const file = healedFiles[i]
    const relevantFixes = failures.filter(f => f.fix).map(f => f.fix).slice(0, 10)
    
    if (!relevantFixes.length) continue

    const { text: healed_content } = await generateText({
      model,
      prompt: `You are a senior engineer doing a targeted code fix. 

FILE: ${file.path}
ORIGINAL CODE:
\`\`\`${file.language}
${file.content.slice(0, 5000)}
\`\`\`

APPLY THESE SPECIFIC FIXES:
${relevantFixes.map((f, i) => `${i+1}. ${f}`).join('\n')}

Rules:
- Apply ALL fixes precisely
- Do not change working code
- Maintain all existing functionality
- Keep the same framework and styling approach
- Output ONLY the complete fixed code, no explanation

Output ONLY the fixed code.`,
      maxTokens: 4000,
    })

    healedFiles[i] = { ...file, content: healed_content }
    healed += relevantFixes.length
  }

  return { files: healedFiles, healed }
}

// ─── PHASE 8: DOCUMENTATION ──────────────────────────────────────────────────

export async function generateIntelligenceDoc(blueprints: SiteBlueprint[], runId: string): Promise<string> {
  const best = blueprints[0]
  
  return `# APEX INTELLIGENCE REPORT
## Run ID: ${runId}
## Generated: ${new Date().toISOString()}

---

# EXECUTIVE SUMMARY

**Target Sites Analyzed:** ${blueprints.length}
**Best Site:** ${best.url} (Score: ${best.overallScore}/100)
**Industry:** ${best.industry} | **Niche:** ${best.niche}
**Estimated Market:** ${best.estimatedTraffic} traffic | ${best.estimatedMRR} MRR

---

# SITE SCORECARD

${blueprints.map((b, i) => `
## #${i+1} — ${b.url} (${b.overallScore}/100)

| Dimension | Score | Grade |
|-----------|-------|-------|
| SEO | ${b.seoStrength}/10 | ${b.seoStrength >= 8 ? '🟢 A' : b.seoStrength >= 6 ? '🟡 B' : '🔴 C'} |
| UX Design | ${b.uxScore}/10 | ${b.uxScore >= 8 ? '🟢 A' : b.uxScore >= 6 ? '🟡 B' : '🔴 C'} |
| Performance | ${b.perfScore}/10 | ${b.perfScore >= 8 ? '🟢 A' : b.perfScore >= 6 ? '🟡 B' : '🔴 C'} |
| Conversion | ${b.conversionScore}/10 | ${b.conversionScore >= 8 ? '🟢 A' : b.conversionScore >= 6 ? '🟡 B' : '🔴 C'} |
| Mobile | ${b.mobileScore}/10 | ${b.mobileScore >= 8 ? '🟢 A' : b.mobileScore >= 6 ? '🟡 B' : '🔴 C'} |
| Security | ${b.securityScore}/10 | ${b.securityScore >= 8 ? '🟢 A' : b.securityScore >= 6 ? '🟡 B' : '🔴 C'} |

**Tech Stack:** ${b.techStack.slice(0, 8).join(', ')}
**Business Model:** ${b.businessModel.join(', ')}
**Target Audience:** ${b.targetAudience}
`).join('\n')}

---

# CRITICAL WEAKNESSES (All Sites)

${blueprints.flatMap(b => b.siteWideWeaknesses.filter(w => w.severity === 'critical')).map(w => `
### 🔴 CRITICAL: ${w.category.toUpperCase()} — ${w.description}
- **Fix:** ${w.fix}
- **Effort:** ${w.effort}
- **Impact:** ${w.estimatedImpact}
`).join('\n')}

# HIGH SEVERITY WEAKNESSES

${blueprints.flatMap(b => b.siteWideWeaknesses.filter(w => w.severity === 'high')).map(w => `
### 🟠 HIGH: ${w.category.toUpperCase()} — ${w.description}
- **Fix:** ${w.fix}
- **Effort:** ${w.effort}
`).join('\n')}

---

# PROFIT OPPORTUNITIES

${blueprints.flatMap(b => b.growthOpportunities).map((o, i) => `${i+1}. ${o}`).join('\n')}

## Missing Features (Revenue Gaps)
${blueprints.flatMap(b => b.missingFeatures).map(f => `- ${f}`).join('\n')}

## Profit Leaks
${blueprints.flatMap(b => b.profitLeaks).map(f => `- ${f}`).join('\n')}

---

# RECONSTRUCTION PLAN

**Approach:** ${best.reconstructionStrategy.approach}
**Tech Stack:** ${best.reconstructionStrategy.techChoices}
**Estimated Hours:** ~${best.reconstructionStrategy.estimatedHours}

## Core Pages
${best.reconstructionStrategy.corePages.map((p, i) => `${i+1}. ${p}`).join('\n')}

## Priority Build Order
${best.reconstructionStrategy.priorityOrder.map((p, i) => `${i+1}. ${p}`).join('\n')}

## Revenue Additions
${best.reconstructionStrategy.revenueAdditions.map(r => `- ${r}`).join('\n')}

## Database Schema
${best.reconstructionStrategy.databaseSchema.map(t => `- ${t}`).join('\n')}

## API Routes
${best.reconstructionStrategy.apiRoutes.map(r => `- ${r}`).join('\n')}

---

# COMPETITIVE ADVANTAGES TO BUILD IN

${blueprints.flatMap(b => b.competitorAdvantages).map(a => `- ${a}`).join('\n')}

---

*Report generated by APEX Agent v${APEX_VERSION}*
`
}

// ─── MASTER RUN ───────────────────────────────────────────────────────────────

export async function runApex(target: ApexTarget): Promise<ApexRun> {
  const runId = `apex_${Date.now()}`
  const startedAt = new Date().toISOString()

  const run: ApexRun = {
    id: runId,
    target,
    status: 'running',
    phase: 'INIT',
    startedAt,
    discoveredSites: [],
    blueprints: [],
    bestSite: '',
    generatedFiles: [],
    testResults: [],
    healedIssues: 0,
    summary: '',
    whatsappBriefing: '',
  }

  try {
    // ── PHASE 1: DISCOVER ──
    run.phase = 'DISCOVER'
    let targetUrls: string[] = []
    
    if (target.url) {
      targetUrls = [target.url]
    } else if (target.niche || target.industry) {
      targetUrls = await discoverTopSites({
        niche: target.niche || target.industry || 'general',
        industry: target.industry || target.niche || 'general',
        country: target.country,
        maxSites: target.maxSites || 3,
      })
    }
    
    run.discoveredSites = targetUrls

    // ── PHASE 2: CRAWL ALL SITES IN PARALLEL ──
    run.phase = 'CRAWL'
    const crawlResults = await Promise.allSettled(
      targetUrls.map(url => deepCrawlSite(url, target.maxPagesPerSite || 12))
    )

    // ── PHASE 3: GENERATE BLUEPRINTS ──
    run.phase = 'ANALYZE'
    const blueprints: SiteBlueprint[] = []
    for (let i = 0; i < targetUrls.length; i++) {
      const crawl = crawlResults[i]
      if (crawl.status !== 'fulfilled' || !crawl.value.length) continue
      if (i > 0) await new Promise(r => setTimeout(r, 8000)) // rate limit buffer between sites
      const blueprint = await generateBlueprint(targetUrls[i], crawl.value)
      blueprints.push(blueprint)
    }

    // ── PHASE 4: RANK ──
    run.phase = 'RANK'
    const ranked = rankBlueprints(blueprints)
    run.blueprints = ranked
    run.bestSite = ranked[0]?.url || targetUrls[0]

    // ── PHASE 5: GENERATE CODE ──
    run.phase = 'GENERATE'
    const mode = target.mode === 'clone' ? 'perfect_clone' : 
                 target.mode === 'enhance' ? 'enhanced_clone' : 'inspired_rebuild'
    const files = await generateCloneFiles(ranked, mode, target.customInstructions)
    run.generatedFiles = files.map(f => ({
      path: f.path,
      lines: f.content.split('\n').length,
      language: f.language,
    }))

    // ── PHASE 6: AUTO-TEST ──
    if (target.autoTest !== false) {
      run.phase = 'TEST'
      run.testResults = await autonomousTest(files)
    }

    // ── PHASE 7: AUTO-HEAL ──
    if (target.autoHeal !== false) {
      run.phase = 'HEAL'
      const { files: healedFiles, healed } = await autoHeal(files, run.testResults)
      run.healedIssues = healed
      
      // Re-test after healing
      if (healed > 0) {
        run.testResults = await autonomousTest(healedFiles)
      }
    }

    // ── PHASE 8: STORE + DOCUMENT ──
    run.phase = 'DOCUMENT'
    const docContent = await generateIntelligenceDoc(ranked, runId)
    
    try {
      const db = getSupabaseAdmin()
      await db.from('apex_runs' as any).insert({
        run_id: runId,
        target_url: target.url || null,
        niche: target.niche || ranked[0]?.niche || null,
        mode: target.mode,
        sites_analyzed: targetUrls.length,
        blueprints_json: ranked,
        test_results_json: run.testResults,
        files_generated: run.generatedFiles.length,
        healed_issues: run.healedIssues,
        doc_content: docContent,
        status: 'complete',
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      })
    } catch (_) {}

    await remember({
      agent_id: APEX_ID,
      memory_type: 'episodic',
      key: runId,
      value: {
        sites: targetUrls,
        best: run.bestSite,
        files: run.generatedFiles.length,
        healed: run.healedIssues,
        testPass: run.testResults.filter(t => t.status === 'pass').length,
        testFail: run.testResults.filter(t => t.status === 'fail').length,
      },
      importance: 8,
    })

    // ── BUILD SUMMARIES ──
    const passCount = run.testResults.filter(t => t.status === 'pass').length
    const failCount = run.testResults.filter(t => t.status === 'fail').length
    const best = ranked[0]

    run.summary = `APEX RUN COMPLETE
Sites analyzed: ${targetUrls.length}
Best site: ${run.bestSite} (${best?.overallScore}/100)
Files generated: ${run.generatedFiles.length}
Tests: ${passCount} passed / ${failCount} failed → ${run.healedIssues} auto-fixed
Critical weaknesses: ${best?.siteWideWeaknesses.filter(w => w.severity === 'critical').length}
Growth opportunities: ${best?.growthOpportunities.length}`

    run.whatsappBriefing = `🤖 *APEX RUN COMPLETE*

🎯 Analyzed: ${targetUrls.length} sites
🏆 Best: ${run.bestSite}
📊 Score: ${best?.overallScore}/100

📁 Generated ${run.generatedFiles.length} files
✅ Tests: ${passCount} pass / ${failCount} fail
🔧 Auto-healed: ${run.healedIssues} issues

🔴 Critical issues found: ${best?.siteWideWeaknesses.filter(w => w.severity === 'critical').length}
💰 Growth opportunities: ${best?.growthOpportunities.length}

Report saved to Supabase. Ready to deploy when you say go.`

    run.status = 'complete'
    run.phase = 'COMPLETE'

  } catch (e: unknown) {
    run.status = 'failed'
    run.summary = `APEX run failed in phase ${run.phase}: ${e instanceof Error ? e.message : String(e)}`
    run.whatsappBriefing = `❌ *APEX RUN FAILED*\nPhase: ${run.phase}\nError: ${e instanceof Error ? e.message : 'Unknown error'}`
  }

  return run
}
