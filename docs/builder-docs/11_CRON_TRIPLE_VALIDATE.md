# Automation Workflow Builder Doc

## Workflow Name
/api/cron/triple-validate — Triple-Check Validation Gate

## Trigger
Every 30 minutes: `*/30 * * * *`

## Business Outcome
Three consecutive validation runs every 30 minutes. If all three pass at 95%+: system is cleared. If any fail: auto-heal triggered. URL NEVER shared until triple-check passes.

## Inputs
- lib/headless-validator.ts — runHumanValidation()
- VERCEL_URL
- CRON_SECRET
- Supabase validation_results table

## Steps
1. Auth check
2. Import runHumanValidation from lib/headless-validator
3. Run 3 consecutive P0-priority validation passes (2s gap between)
4. Calculate avg score across 3 runs
5. allCleared = all 3 runs have url_cleared=true
6. Store results in Supabase validation_results
7. If not cleared: trigger auto-heal
8. Return { triple_check, runs, avg_score, all_cleared }

## Approval Gates
URL is NEVER surfaced to Jeremy until all_cleared=true AND avg_score >= 95

## Failure Paths
- Validator timeout: count as failed run, trigger auto-heal

## Receipts
Supabase validation_results: { run_id, avg_score, all_cleared, runs_json, timestamp }
