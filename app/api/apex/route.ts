/**
 * APEX API — /api/apex
 * 
 * The master command surface for the APEX agent.
 * Handles all clone/analyze/test/heal/discover commands.
 * Auth: Bearer BRIDGE_SECRET
 * 
 * Commands:
 *   run       — Full autonomous APEX run (discover → clone → test → heal → doc)
 *   analyze   — Analyze one or more sites, return blueprints
 *   discover  — Find top sites in a niche
 *   test      — Test existing code files
 *   heal      — Auto-fix failing tests
 *   status    — Get status of a run by ID
 *   history   — List recent APEX runs
 */

import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function auth(req: NextRequest): boolean {
  return req.headers.get('authorization') === `Bearer ${process.env.BRIDGE_SECRET}`
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const runId = url.searchParams.get('run_id')

  if (runId) {
    // Get specific run status
    const { getSupabaseAdmin } = await import('@/lib/supabase')
    const db = getSupabaseAdmin()
    const { data } = await db
      .from('apex_runs' as any)
      .select('run_id, status, mode, sites_analyzed, files_generated, healed_issues, started_at, completed_at, niche')
      .eq('run_id', runId)
      .single()
    return NextResponse.json({ run: data })
  }

  // List recent runs
  const { getSupabaseAdmin } = await import('@/lib/supabase')
  const db = getSupabaseAdmin()
  const { data } = await db
    .from('apex_runs' as any)
    .select('run_id, status, mode, sites_analyzed, files_generated, healed_issues, started_at, completed_at, niche')
    .order('started_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    agent: 'APEX',
    version: '2.0.0',
    status: 'operational',
    capabilities: [
      'discover_top_sites — find top 3-5 sites in any niche globally',
      'deep_crawl — parallel multi-page inhalation up to 20 pages',
      'blueprint_generation — full tech+business+UX analysis',
      'code_generation — Next.js 14 + TS + Tailwind clone generation',
      'autonomous_testing — frontend + backend + security + SEO tests',
      'auto_heal — self-fix all failing tests without human input',
      'intelligence_docs — enterprise Markdown reports to Supabase',
      'github_push — auto-commit all generated files',
      'niche_hunt — find profitable niches anywhere in the world',
    ],
    recentRuns: data || [],
  })
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    command,
    url,
    urls,
    niche,
    industry,
    country,
    mode = 'enhance',
    maxPages = 15,
    maxSites = 3,
    customInstructions,
    autoTest = true,
    autoHeal = true,
    autoDeploy = false,
    generateDocs = true,
    runId,
  } = body as Record<string, unknown>

  try {
    // ── FULL APEX RUN ──────────────────────────────────────────────────────
    if (command === 'run') {
      const { runApex } = await import('@/agents/apex')
      
      const result = await runApex({
        url: url as string | undefined,
        niche: niche as string | undefined,
        industry: industry as string | undefined,
        country: country as string | undefined,
        mode: (mode as 'clone' | 'enhance' | 'discover_and_clone' | 'audit' | 'niche_hunt') || 'enhance',
        maxPages: maxPages as number,
        maxSites: maxSites as number,
        customInstructions: customInstructions as string | undefined,
        autoTest: autoTest as boolean,
        autoHeal: autoHeal as boolean,
        autoDeploy: autoDeploy as boolean,
        generateDocs: generateDocs as boolean,
      })

      return NextResponse.json({
        success: result.status === 'complete',
        runId: result.id,
        status: result.status,
        phase: result.phase,
        discoveredSites: result.discoveredSites,
        bestSite: result.bestSite,
        blueprintCount: result.blueprints.length,
        filesGenerated: result.generatedFiles,
        testResults: {
          total: result.testResults.length,
          pass: result.testResults.filter(t => t.status === 'pass').length,
          fail: result.testResults.filter(t => t.status === 'fail').length,
          warning: result.testResults.filter(t => t.status === 'warning').length,
        },
        healedIssues: result.healedIssues,
        summary: result.summary,
        whatsappBriefing: result.whatsappBriefing,
        topOpportunities: result.blueprints[0]?.growthOpportunities?.slice(0, 5) || [],
        criticalWeaknesses: result.blueprints[0]?.siteWideWeaknesses?.filter(w => w.severity === 'critical') || [],
      })
    }

    // ── DISCOVER ONLY ──────────────────────────────────────────────────────
    if (command === 'discover') {
      if (!niche && !industry) return NextResponse.json({ error: 'niche or industry required' }, { status: 400 })
      const { discoverTopSites } = await import('@/agents/apex')
      const sites = await discoverTopSites({
        niche: niche as string || industry as string,
        industry: industry as string || niche as string,
        country: country as string | undefined,
        maxSites: maxSites as number || 5,
      })
      return NextResponse.json({ success: true, command: 'discover', sites })
    }

    // ── ANALYZE ONLY ──────────────────────────────────────────────────────
    if (command === 'analyze') {
      const targetUrls: string[] = url ? [url as string] : (urls as string[] || [])
      if (!targetUrls.length) return NextResponse.json({ error: 'url or urls required' }, { status: 400 })

      const { deepCrawlSite, generateBlueprint, rankBlueprints } = await import('@/agents/apex')
      
      const crawls = await Promise.allSettled(
        targetUrls.map(u => deepCrawlSite(u, maxPages as number || 12))
      )
      
      const blueprints = []
      for (let i = 0; i < targetUrls.length; i++) {
        const crawl = crawls[i]
        if (crawl.status !== 'fulfilled' || !crawl.value.length) continue
        const bp = await generateBlueprint(targetUrls[i], crawl.value)
        blueprints.push(bp)
      }

      const ranked = rankBlueprints(blueprints)
      return NextResponse.json({ success: true, command: 'analyze', blueprints: ranked })
    }

    // ── QUICK CRAWL ───────────────────────────────────────────────────────
    if (command === 'crawl') {
      if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })
      const { deepCrawlSite } = await import('@/agents/apex')
      const pages = await deepCrawlSite(url as string, maxPages as number || 10)
      return NextResponse.json({
        success: true,
        command: 'crawl',
        url,
        pagesFound: pages.length,
        pages: pages.map(p => ({
          url: p.url,
          status: p.status,
          loadTimeMs: p.loadTimeMs,
          title: p.title,
          wordCount: p.wordCount,
          techSignals: p.techSignals,
          ctas: p.ctas.slice(0, 5),
          seoIssues: p.seoIssues,
          perfIssues: p.perfIssues,
          accessibilityIssues: p.accessibilityIssues,
          features: {
            hasAuth: p.hasAuth,
            hasPricing: p.hasPricing,
            hasCheckout: p.hasCheckout,
            hasDashboard: p.hasDashboard,
            hasBlog: p.hasBlog,
            mobileViewport: p.mobileViewport,
          },
        })),
      })
    }

    return NextResponse.json({
      error: `Unknown command: ${command}`,
      available: ['run', 'discover', 'analyze', 'crawl'],
    }, { status: 400 })

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[APEX ERROR]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
