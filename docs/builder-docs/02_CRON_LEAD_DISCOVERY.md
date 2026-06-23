# Automation Workflow Builder Doc

## Workflow Name
/api/cron/lead-discovery — Daily Lead Discovery

## Trigger
Daily at 11:00 AM UTC (6 AM ET): `0 11 * * *`

## Business Outcome
XPS gets 50-200 real, verified leads every day. Zero hallucination. Real scraping only.

## Inputs
- GOOGLE_MAPS_API_KEY (env)
- YELP_API_KEY (env)
- CRON_SECRET (env)
- Search terms: ["epoxy flooring contractor", "concrete coating", "garage floor coating", "polished concrete"]
- Location: "Arizona"

## Systems Involved
- agents/discovery.ts — orchestrates all scraping
- lib/scraper.ts — Google Maps + Yelp + AZ Registry scrapers
- Supabase companies table — lead storage
- agents/reflection.ts — post-run reflection

## Steps
1. Auth check
2. Import runXPSDiscovery from agents/discovery
3. Call runXPSDiscovery() — parallel scrape 4 sources simultaneously
4. Returns { discovered, stored, leads }
5. Log to Supabase scrape_runs: { run_name, source, total_records, new_records, status }
6. Run reflect() with lead count
7. Return JSON with stats

## AI Enhancements
No AI in scraping — real data only. AI scoring happens in lead-scoring cron.

## Manual Work Replaced
Manual searching of Google Maps, Yelp, AZ Corp Commission for leads.

## Approval Gates
None — fully autonomous. Runs every day.

## Failure Paths
- Google Maps API quota exceeded: fall back to Yelp + AZ Registry only
- Zero leads found: alert Jeremy, log to Supabase
- Supabase write fails: retry 3x, log error

## Receipts
Supabase scrape_runs row: { run_name, run_date, source, total_records, new_records, status }

## Monitoring
- Lead count visible in daily briefing
- Alert if < 5 leads discovered

## Rollback
N/A — read-only scraping, no destructive operations

## Vercel Workflow Notes
- maxDuration: 60s
- Requires GOOGLE_MAPS_API_KEY and YELP_API_KEY secrets
- Falls back gracefully if APIs unavailable
