/**
 * APEX Weekly Autonomous Scan — /api/cron/apex-scan
 * Vercel Cron: "0 6 * * 1" (6am UTC every Monday)
 * 
 * Autonomously discovers top sites in configured niches,
 * analyzes them, generates clone code, tests, heals, and 
 * sends a WhatsApp briefing to Jeremy.
 */

import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { runApex } = await import('@/agents/apex')
    
    // Weekly autonomous run — discover best sites in 2 random niches and analyze them
    const niches = [
      { niche: 'SaaS project management', industry: 'Software' },
      { niche: 'epoxy flooring contractor', industry: 'Construction' },
      { niche: 'digital marketing agency', industry: 'Marketing' },
      { niche: 'online fitness coaching', industry: 'Health & Fitness' },
    ]
    
    // Pick one random niche for the weekly scan
    const target = niches[Math.floor(Math.random() * niches.length)]
    
    const result = await runApex({
      niche: target.niche,
      industry: target.industry,
      mode: 'discover_and_clone',
      maxSites: 3,
      maxPagesPerSite: 10,
      autoTest: true,
      autoHeal: true,
      generateDocs: true,
    })

    return NextResponse.json({
      success: result.status === 'complete',
      runId: result.id,
      niche: target.niche,
      sitesAnalyzed: result.discoveredSites.length,
      filesGenerated: result.generatedFiles.length,
      healedIssues: result.healedIssues,
      summary: result.summary,
    })

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
