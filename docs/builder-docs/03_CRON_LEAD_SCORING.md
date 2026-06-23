# Automation Workflow Builder Doc

## Workflow Name
/api/cron/lead-scoring — AI Lead Scoring

## Trigger
Daily at 12:00 PM UTC (7 AM ET): `0 12 * * *`
(Runs 1 hour after lead-discovery to ensure fresh leads are available)

## Business Outcome
Every lead gets an AI score (0-100), a tier (S/A/B/C), a pitch recommendation, and an AI profile summary. Jeremy sees only what matters.

## Inputs
- Unscored leads from Supabase (lead_score IS NULL)
- GROQ_API_KEY (env)
- agents/intelligence.ts

## Systems Involved
- agents/intelligence.ts — Groq-powered scoring
- Supabase companies table — read unscored, write scores
- agents/reflection.ts — post-run reflection

## Steps
1. Auth check
2. Import runIntelligence from agents/intelligence
3. Pull up to 25 unscored companies from Supabase
4. Call runIntelligence() — parallel scoring via Groq llama-3.3-70b-versatile
5. Each lead gets: lead_score (0-100), priority_tier (S/A/B/C), ai_profile_summary, ai_pitch_recommendation, ai_next_action
6. Update companies rows in Supabase
7. Log to scrape_runs: { run_name: "lead-scoring", total_records, new_records }
8. Run reflect()
9. Return scoring stats

## AI Enhancements
Groq llama-3.3-70b-versatile with XPS-specific scoring rubric:
- S-tier: commercial property, large fleet, multiple locations, high review count
- A-tier: established business, phone available, active website
- B-tier: verified but limited data
- C-tier: incomplete data, likely residential

## Manual Work Replaced
Sales rep manually evaluating which leads to call first.

## Approval Gates
None — fully autonomous

## Failure Paths
- Groq rate limit: score 10 leads, queue rest for next cycle
- Supabase write fails: retry 3x
- Zero unscored leads: log and exit cleanly

## Receipts
Updated companies rows + scrape_runs log entry

## Monitoring
- S-tier lead count in daily briefing
- Alert if Groq errors exceed 5 consecutive failures

## Rollback
lead_score and priority_tier can be reset to NULL for re-scoring
