# VERCEL WORKFLOW SYSTEM — SPEC
# Builder Doc 03 | 5-Minute Trigger Architecture

## PAID TIER CRON SCHEDULE (Vercel Pro — */5 supported)

| Cron | Schedule | Description |
|------|----------|-------------|
| /api/cron/auto-loop | */5 * * * * | MASTER — runs all 12 stages |
| /api/cron/auto-validate | */30 * * * * | Triple validation every 30 min |
| /api/cron/auto-heal | */15 * * * * | Heal degraded capabilities |
| /api/cron/lead-discovery | 0 6 * * * | Daily lead discovery 6am |
| /api/cron/lead-scoring | 0 7 * * * | Daily lead scoring 7am |
| /api/cron/outreach-followup | 0 9 * * 1-5 | Weekday outreach 9am |
| /api/cron/daily-briefing | 0 8 * * * | Morning briefing 8am |
| /api/cron/weekly-report | 0 8 * * 1 | Monday weekly report |
| /api/cron/benchmark | 0 3 * * * | Nightly benchmark 3am |
| /api/cron/auto-install | 0 2 * * * | Nightly capability install |

## VERCEL WORKFLOW STAGES
Each cron calls a Vercel Workflow (durable, stateful, survives timeouts):
1. Workflow starts → logs to Supabase
2. Stages execute sequentially with state handoff
3. If stage fails: retry 3x with exponential backoff
4. On complete: update Supabase + notify owner
5. Next trigger picks up from clean state

## VALIDATION SCHEDULE
- Every 30 min: /api/cron/auto-validate runs triple-check
- Results stored in test_memory (Supabase)
- If score < 95%: immediately trigger auto-fix
- If critical failure: alert Jeremy via WhatsApp

## VERCEL AGENT VALIDATION
Vercel Agents integration:
- Agent endpoint: /api/agents/validator
- Model: gpt-4o (configured in Vercel dashboard)
- Tools: HTTP test, DB check, endpoint probe
- Auto-called by auto-validate cron
