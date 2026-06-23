# Automation Workflow Builder Doc

## Workflow Name
/api/cron/evolve — Autonomous Evolution Cycle

## Trigger
Every 6 hours: `0 */6 * * *`

## Business Outcome
Agent Zero improves itself every 6 hours. Gaps close automatically. Capabilities expand. No human needed to manage the system's growth.

## Inputs
- agents/evolution.ts — runEvolutionCycle()
- Current benchmark score from Supabase
- Reflection findings from last cycle
- agents/apex.ts — generates new code for identified gaps

## Systems Involved
- agents/evolution.ts (11-step loop)
- agents/apex.ts (code generation for improvements)
- agents/validator.ts (validates improvements)
- Supabase evolution_runs table
- GitHub (code pushes if improvements generated)

## Steps
1. Auth check
2. Pull current_score from last benchmark run in Supabase
3. Pull recommendations from last reflection entry
4. Import runEvolutionCycle from agents/evolution
5. Run 11-step loop: analyze, create, validate, fix, heal, harden, optimize, enhance, test, document, evolve
6. If improvements identified: queue for APEX to implement
7. Log to Supabase evolution_runs
8. Return { cycle, improvements, delta }

## AI Enhancements
Groq analyzes benchmark gaps and generates specific improvement tasks.

## Approval Gates
APEX code pushes only happen after validator confirms improvement

## Failure Paths
- No score available: use default 70 baseline
- APEX push fails: queue improvement for next cycle

## Receipts
Supabase evolution_runs: { run_id, cycle, current_score, target_score, improvements, ran_at }

## Monitoring
Evolution progress in weekly report
