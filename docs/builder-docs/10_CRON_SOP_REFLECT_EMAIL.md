# Automation Workflow Builder Doc

## Workflow Name
/api/cron/sop-reflect-email — 4-Hour SOP + Reflection + Email

## Trigger
Every 4 hours: `0 */4 * * *`

## Business Outcome
Every 4 hours: SOPs updated, self-reflection written, email summary sent to Jeremy if significant findings. System documents itself continuously.

## Inputs
- agents/sop.ts — saveSOPs()
- agents/reflection.ts — reflect()
- agents/reporter.ts — sendDailyBriefing() if significant
- Supabase agent_reflections, agent_sops tables

## Steps
1. Auth check
2. Import saveSOPs, reflect, sendDailyBriefing
3. Run in parallel: Promise.all([saveSOPs(), reflect({...})])
4. If health_score < 70: send alert email to Jeremy
5. Store reflection in Supabase
6. Return { sops_saved, reflection_score, email_sent }

## Failure Paths
- Supabase write fails: log to console, retry next cycle
- Email send fails: log only, non-fatal

## Receipts
Supabase agent_sops + agent_reflections rows updated
