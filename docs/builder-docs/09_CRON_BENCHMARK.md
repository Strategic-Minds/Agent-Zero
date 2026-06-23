# Automation Workflow Builder Doc

## Workflow Name
/api/cron/benchmark — Daily Performance Benchmark

## Trigger
Daily at 8:00 AM UTC (3 AM ET): `0 8 * * *`

## Business Outcome
Every morning before Jeremy's briefing: Agent Zero scores itself against 30 FAANG-grade tests. Score goes into daily briefing. Regression detected automatically.

## Inputs
- agents/validator.ts — runValidation() + tripleCheck()
- lib/benchmark-engine.ts — scoring matrix
- VERCEL_URL (env)
- Supabase benchmark_results table

## Systems Involved
- agents/validator.ts (30-test suite)
- lib/benchmark-engine.ts (capability scoring)
- Supabase (results storage)

## Steps
1. Auth check
2. Import runValidation from agents/validator
3. Run full 30-test validation against production URL
4. Import benchmark engine — calculate capability score
5. Compare to previous day score — calculate delta
6. Store in Supabase benchmark_results: { score, grade, passed, failed, delta, timestamp }
7. If grade dropped: trigger auto-heal immediately
8. Return benchmark result

## AI Enhancements
None — benchmark is objective measurement, not AI assessment

## Failure Paths
- Production URL unreachable: log failure, alert Jeremy
- Previous score missing: baseline at 70

## Receipts
Supabase benchmark_results: { run_id, score, grade, passed, failed, delta, deployment_approved, timestamp }

## Monitoring
Score trend in weekly report
