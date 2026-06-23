# Automation Workflow Builder Doc

## Workflow Name
/api/cron/auto-heal — Self-Healing Loop

## Trigger
Every 15 minutes via Vercel cron: `*/15 * * * *`

## Business Outcome
System detects failing routes and fixes itself automatically. No human needed. Agent Zero heals its own code.

## Inputs
- Production deployment URL (from VERCEL_URL env var)
- CRON_SECRET for auth
- APEX agent for code repair

## Systems Involved
- Vercel (execution + redeploy trigger)
- agents/validator.ts (30-test headless validation)
- agents/apex.ts (autonomous code fix + GitHub push)
- agents/reflection.ts (post-heal reflection)
- Supabase (heal log persistence)
- GitHub (code push for fixes)

## Steps
1. Auth check — reject if CRON_SECRET missing
2. Import runValidation from agents/validator
3. Run validation against production URL
4. If score >= 80: log healthy status to Supabase, return
5. If score < 80: identify failing test names
6. Import runApex from agents/apex — call with failing test list
7. APEX generates fix, pushes to GitHub, triggers Vercel redeploy
8. Wait 150s for build. Re-run validation.
9. Log heal result to Supabase (heal_logs table)
10. Run reflect() — write reflection entry
11. If score still < 80 after fix: email Jeremy

## AI Enhancements
APEX uses Groq llama-3.3-70b-versatile to generate TypeScript fixes for failing routes.

## Manual Work Replaced
Engineer reviewing error logs and manually patching routes.

## Approval Gates
- If APEX proposes changes to lib/supabase.ts or lib/orchestrator.ts: log only, do not auto-push
- If validator score drops below 50: alert Jeremy before any auto-fix

## Failure Paths
- APEX push fails: log error, alert Jeremy, retry next cycle
- Vercel build fails: log build error, alert Jeremy
- Validator unreachable: skip cycle, log timeout

## Receipts
Upsert to Supabase heal_logs: { run_id, pre_score, post_score, fixes_applied, timestamp }

## Monitoring
- Self-monitors via validator
- Reports in daily briefing

## Rollback
Revert last GitHub commit via GitHub API if post-fix score < pre-fix score
