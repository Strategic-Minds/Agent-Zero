# Automation Workflow Builder Doc

## Workflow Name
/api/cron/daily-briefing — Morning Briefing to Jeremy

## Trigger
Daily at 1:00 PM UTC (8 AM ET): `0 13 * * *`

## Business Outcome
Jeremy gets an HTML email every morning with: leads found, S-tier leads ready, system health, evolution cycle status, competitor highlights. He never has to log in to know what's happening.

## Inputs
- agents/reporter.ts — compileReport() + buildEmailHTML() + sendDailyBriefing()
- agents/evolution.ts — current evolution cycle
- agents/reflection.ts — daily health score
- RESEND_API_KEY (env)
- Supabase: companies, agent_reflections, evolution_runs

## Systems Involved
- agents/reporter.ts (email composition + send)
- Supabase (stats queries)
- Resend API (email delivery)

## Steps
1. Auth check
2. Import sendDailyBriefing, runEvolutionCycle, reflect from agents/
3. Run all three in parallel: Promise.all([sendDailyBriefing(), runEvolutionCycle({...}), saveSOPs()])
4. Run reflect() on the combined result
5. Return status

## AI Enhancements
reporter.ts compiles human-readable insights. No direct AI call in this cron — agents handle it.

## Manual Work Replaced
Jeremy manually checking dashboard, Supabase, Vercel logs every morning.

## Approval Gates
Email sent regardless — Jeremy opted in

## Failure Paths
- RESEND_API_KEY missing: log report to console, email Jeremy on next successful send
- Supabase query fails: use fallback zeros, still send email

## Receipts
Supabase email_logs: { sent_at, subject, status, leads_count, health_score }

## Monitoring
If email fails 3 days in a row: log to Supabase and add WhatsApp fallback

## Vercel Workflow Notes
- maxDuration: 60s
- Requires RESEND_API_KEY secret
