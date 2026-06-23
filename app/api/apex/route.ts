/**
 * APEX API — /api/apex
 * Discovery + clone + analyze + heal commands
 */
import { NextRequest, NextResponse } from "next/server"

function auth(req: NextRequest): boolean {
  return req.headers.get('authorization') === `Bearer ${process.env.BRIDGE_SECRET}`
}

export async function GET() {
  // Always returns JSON — DB optional
  let runs: unknown[] = []
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase')
    const db = getSupabaseAdmin()
    const res = await db.from('apex_runs' as any).select('*').order('started_at', { ascending: false }).limit(10)
    runs = res.data || []
  } catch { /* DB not yet provisioned */ }

  return NextResponse.json({
    ok: true,
    agent: 'APEX',
    version: '2.0.0',
    status: 'active',
    runs,
    capabilities: ['clone', 'analyze', 'discover', 'audit', 'heal'],
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
        maxPagesPerSite: maxPages as number,
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
