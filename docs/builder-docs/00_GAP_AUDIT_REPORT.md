# Automation Workflow Builder Doc

## Workflow Name
Agent Zero Forensic Gap Audit — 2026-06-22

## Trigger
Manual execution + auto-runs on every evolution cycle

## Business Outcome
Every cron route is fully wired to a real agent, writes real data to Supabase, and uses real AI. Zero stubs. Zero mocks. Zero hallucination.

## Inputs
- 14 Vercel cron routes
- 12 agent files
- 20 lib files
- vercel.json schedule

## Systems Involved
- Vercel (cron execution)
- Supabase (data persistence)
- Groq / OpenAI (AI calls)
- GitHub (code source)
- Agent Zero agents (business logic)

## Audit Results — 13 Gaps Found

| Score | Cron Route | Gap | Priority |
|-------|-----------|-----|----------|
| 20/100 | /api/cron/auto-heal | No real agent import, no Supabase, no AI | P0 |
| 20/100 | /api/cron/lead-discovery | No real agent import | P0 |
| 20/100 | /api/cron/lead-scoring | No real agent import | P0 |
| 20/100 | /api/cron/outreach-followup | No real agent import | P0 |
| 30/100 | /api/cron/apex-scan | No Supabase, no AI | P0 |
| 50/100 | /api/cron/auto-loop | No Supabase, no AI | P1 |
| 50/100 | /api/cron/evolve | No Supabase, no AI | P1 |
| 50/100 | /api/cron/daily-briefing | No Supabase, no AI | P1 |
| 50/100 | /api/cron/auto-install | No Supabase, no AI | P1 |
| 50/100 | /api/cron/auto-validate | No Supabase, no AI | P1 |
| 60/100 | /api/cron/triple-validate | No Supabase | P2 |
| 60/100 | /api/cron/sop-reflect-email | No Supabase | P2 |
| 60/100 | /api/cron/benchmark | No Supabase | P2 |

## AI Enhancements
Each cron must call its corresponding agent which handles all AI logic.
No cron should call an LLM directly — that is the agent's job.

## Approval Gates
- Each gap builder doc must be reviewed before implementation
- Cron must be tested locally before Vercel deploy
- Validator must confirm route reaches 80+ score before marking complete

## Steps (Execution Order)
1. Fix all P0 gaps first (auto-heal, lead-discovery, lead-scoring, outreach-followup, apex-scan)
2. Fix P1 gaps (auto-loop, evolve, daily-briefing, auto-install, auto-validate)
3. Fix P2 gaps (triple-validate, sop-reflect-email, benchmark)
4. Run full 30-test validator suite
5. Confirm all crons score 80+ in next audit

## Receipts
- This document is the receipt for the 2026-06-22 audit
- All gap builder docs live in docs/builder-docs/

## Monitoring
- Evolution agent re-runs this audit every 6 hours
- If any cron drops below 70/100, alert Jeremy by email

## Rollback
- If a cron fix breaks the build: revert the specific route file
- All other crons remain operational

## n8n Implementation Notes
N/A — all crons run natively on Vercel, no n8n required

## Vercel Workflow Notes
- All 14 crons defined in vercel.json
- Requires CRON_SECRET env var for auth
- maxDuration: 60s for fast crons, 300s for heavy ones (benchmark, triple-validate)

## Supabase Queue Notes
- All cron results should upsert to scrape_runs or agent_reflections table
- Use onConflict to avoid duplicates
