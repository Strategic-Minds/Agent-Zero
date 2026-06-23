# Automation Workflow Builder Doc

## Workflow Name
/api/cron/apex-scan — Autonomous APEX Competitor Scan

## Trigger
Weekly on Sunday at 11 PM UTC: `0 23 * * 0`

## Business Outcome
Agent Zero clones all known AZ epoxy competitor sites, extracts intelligence, identifies their weaknesses, and stores findings in Supabase. XPS always knows what competitors are doing.

## Inputs
- Known competitor URLs (hardcoded in agents/ghost.ts + dynamically from Supabase)
- agents/ghost.ts — site cloner + intelligence extractor
- agents/apex.ts — competitive analysis
- GROQ_API_KEY

## Systems Involved
- agents/ghost.ts — shadowCloneSite() parallel cloning
- agents/apex.ts — competitive analysis + weakness detection
- Supabase competitor_intel table
- agents/reflection.ts

## Steps
1. Auth check
2. Import shadowCloneSite from agents/ghost (via shadow.ts)
3. Pull competitor URLs from Supabase or use default list
4. Run parallel clone: Promise.all(competitors.map(url => shadowCloneSite(url, { maxPages: 5 })))
5. For each cloned site: extract services, pricing, contact info, tech stack, weaknesses
6. Generate competitive analysis via Groq
7. Store in Supabase competitor_intel table
8. Include highlights in next daily briefing
9. Run reflect()

## AI Enhancements
Groq analyzes cloned site content: "Based on this competitor's site, what are their top 3 weaknesses XPS can exploit?"

## Manual Work Replaced
Sales manager manually researching competitors. Replaced by autonomous weekly scan.

## Approval Gates
None — read-only scraping of public sites

## Failure Paths
- Competitor site unreachable: use last cached data, log skip
- Groq analysis fails: store raw clone data without analysis
- Supabase write fails: log error, retry next cycle

## Receipts
Supabase competitor_intel: { url, pages_cloned, services, weaknesses, tech_stack, scanned_at }

## Monitoring
- Competitor count in weekly report
- Alert if zero competitors scanned 2 weeks in a row

## Rollback
competitor_intel is append-only — no rollback needed
