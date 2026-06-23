# Automation Workflow Builder Doc

## Workflow Name
/api/cron/auto-loop — 5-Minute Master Orchestration Loop

## Trigger
Every 5 minutes: `*/5 * * * *`

## Business Outcome
Agent Zero checks its own health every 5 minutes and triggers the appropriate sub-agent if work is queued. This is the heartbeat of the entire system.

## Inputs
- Supabase queue: pending tasks, unscored leads, unsent outreach
- agents/validator.ts — health check
- agents/reflection.ts — micro-reflection

## Systems Involved
- Supabase (queue check)
- agents/validator.ts (fast health check)
- All 8 sub-agents (if work is queued)

## Steps
1. Auth check
2. Quick health check: GET /api/health — if 200, continue
3. Check Supabase for: unscored leads count, pending outreach count, any error flags
4. If unscored leads > 0 and it's business hours: trigger /api/cron/lead-scoring
5. If system error flags: trigger /api/cron/auto-heal
6. Log micro-stats to Supabase: { loop_id, health_ok, unscored_leads, flags_cleared }
7. Return loop result

## AI Enhancements
None — this is a routing/orchestration loop. AI happens in sub-agents.

## Manual Work Replaced
DevOps engineer monitoring system health and manually triggering workflows.

## Approval Gates
None — this is the autonomy heartbeat

## Failure Paths
- Health check fails: immediately trigger auto-heal
- Supabase unreachable: log only, do not cascade failures

## Receipts
Supabase loop_logs: { loop_id, timestamp, health_ok, actions_triggered }

## Vercel Workflow Notes
- maxDuration: 30s — must be fast
- Most expensive cron in terms of invocations: 288/day
