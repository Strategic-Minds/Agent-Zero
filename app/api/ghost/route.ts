/**
 * Ghost Agent API — /api/ghost
 * 
 * POST /api/ghost — run a full site analysis + clone generation
 * GET  /api/ghost — list recent ghost runs
 * 
 * Auth: Bearer BRIDGE_SECRET
 * 
 * Body:
 * {
 *   "command": "analyze" | "clone" | "niches" | "status",
 *   "url": "https://target-site.com",
 *   "maxPages": 20,
 *   "approach": "perfect_clone" | "enhanced_clone" | "inspired_rebuild" | "niche_pivot",
 *   "pushToGithub": true,
 *   "customInstructions": "...",
 *   // For niches command:
 *   "industry": "SaaS",
 *   "country": "Brazil",
 *   "budget": "$5000",
 *   "skills": "web development"
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 min max for deep crawls

function auth(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.BRIDGE_SECRET}`
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { command, url, maxPages = 15, approach = 'enhanced_clone', pushToGithub = false, customInstructions, industry, country, budget, skills } = body

    if (command === 'analyze' || command === 'clone') {
      if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

      const { runGhost } = await import('@/agents/ghost')
      const result = await runGhost(url, { maxPages, approach, pushToGithub, customInstructions })
      
      return NextResponse.json({
        success: true,
        command,
        url,
        crawlStats: result.crawlStats,
        intelligence: result.intelligence,
        files: result.files.map(f => ({ path: f.path, preview: f.content.slice(0, 500) })),
        fullFiles: result.files,
        summary: result.summary,
      })
    }

    if (command === 'niches') {
      const { findProfitableNiches } = await import('@/agents/ghost')
      const result = await findProfitableNiches({ industry, country, budget, skills, existingSite: url })
      return NextResponse.json({ success: true, command: 'niches', ...result })
    }

    if (command === 'quick_scan') {
      if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })
      
      // Fast 3-page scan — no full AI analysis
      const { deepCrawl } = await import('@/agents/ghost')
      const crawl = await deepCrawl(url, 3)
      
      return NextResponse.json({
        success: true,
        command: 'quick_scan',
        url,
        pages: crawl.totalPages,
        crawlTime: crawl.crawlTime,
        techStack: [...new Set(crawl.pages.flatMap(p => p.techStack))],
        titles: crawl.pages.map(p => ({ url: p.url, title: p.meta.title, words: p.wordCount, loadTime: p.loadTime })),
        allLinks: [...new Set(crawl.pages.flatMap(p => p.links))].slice(0, 30),
      })
    }

    return NextResponse.json({ error: `Unknown command: ${command}. Use: analyze, clone, niches, quick_scan` }, { status: 400 })

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    agent: 'GHOST',
    status: 'operational',
    version: '1.0.0',
    commands: ['analyze', 'clone', 'niches', 'quick_scan'],
    description: 'Universal site clone & intelligence engine',
  })
}
