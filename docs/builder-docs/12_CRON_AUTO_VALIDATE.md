# Automation Workflow Builder Doc

## Workflow Name
/api/cron/auto-validate — 6-Hour Auto Validation

## Trigger
Every 6 hours: `0 */6 * * *`

## Business Outcome
Full 30-test headless validation runs every 6 hours. Stores score to Supabase. Drives evolution cycle input.

## Inputs
- agents/validator.ts — runValidation()
- VERCEL_URL
- Supabase benchmark_results

## Steps
1. Auth check
2. Import runValidation from agents/validator (NOT old headless-validator)
3. Run 3 validation passes with 5s gap
4. Average scores, determine allCleared
5. Store to Supabase
6. If avg < 80: trigger auto-heal endpoint
7. Return result

## Receipts
Supabase benchmark_results row upserted

## Vercel Workflow Notes
maxDuration: 300s — allows 3 full validation passes
