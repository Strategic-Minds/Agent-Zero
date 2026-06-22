# AGENT ZERO — MASTER ARCHITECTURE DOCUMENT
# Builder Doc 01 | Version 4.0 | Auto-Generated + Auto-Maintained

## MISSION
Fully autonomous enterprise-grade AI swarm system for Strategic Minds Advisory / XPS Intelligence.
Operates 24/7 without human intervention. Self-analyzes, self-heals, self-evolves.
Target: FAANG Grade A+ across all 30 capability dimensions.

## SYSTEM IDENTITY
- **Project:** Agent Zero
- **Owner:** Jeremy Bensen / Strategic Minds Advisory
- **Repo:** Strategic-Minds/Agent-Zero
- **Production:** https://agent-zero.vercel.app
- **Stack:** Next.js 14 · Vercel · Supabase · GitHub · Groq · OpenAI · Anthropic

## ARCHITECTURE LAYERS

### Layer 0: Infrastructure
- Vercel Pro (paid) — hosting, crons, edge functions, Vercel Workflow, Vercel Sandbox
- Supabase — persistent memory, vector search, all agent state
- GitHub — version control, CI/CD, auto-push from APEX agent
- Vercel AI Gateway — unified LLM routing (Groq → OpenAI → Anthropic cascade)

### Layer 1: Core Agents (8 active)
| Agent | Role | Model | Endpoint |
|-------|------|-------|----------|
| ARIA | Conversational intelligence, CRM, WhatsApp | Groq Llama 8B fast | /api/aria |
| Discovery | Real web scraping, lead generation | Groq 70B + fetch | /api/cron/lead-discovery |
| Intelligence | Lead scoring, profiling, market analysis | GPT-4o-mini | /api/cron/lead-scoring |
| Outreach | Pitches, proposals, follow-up sequences | GPT-4o | /api/cron/outreach |
| GHOST | Headless web intel, competitor cloning | Groq 70B | /api/ghost |
| APEX | Autonomous coding, self-healing, GitHub ops | GPT-4o / Claude | /api/apex |
| Validator | 30-test FAANG validation suite | Fast model | /api/validate |
| Benchmark | Capability scoring vs industry leaders | Fast model | /api/benchmark |

### Layer 2: Orchestration
- Master Orchestrator: fans tasks to N agents in parallel via Promise.all()
- Swarm Engine: 20+ concurrent tasks, dependency graph resolution
- Workflow Engine: 8 repeatable named workflows (n8n-compatible)
- Auto-Loop: 12-stage autonomous evolution cycle (analyze→create→validate→fix→heal→harden→optimize→enhance→test→document→reflect→evolve)

### Layer 3: Autonomous Loop (THE CORE)
Every 5 minutes via Vercel Cron + Workflow trigger:
1. ANALYZE — score current system state
2. CREATE — generate improvements
3. VALIDATE — triple-check via Validator Agent
4. FIX — auto-fix any failures
5. HEAL — restore degraded capabilities
6. HARDEN — security + reliability improvements
7. OPTIMIZE — performance tuning
8. ENHANCE — add new capabilities
9. TEST — run full 30-test suite
10. DOCUMENT — auto-update all builder docs
11. REFLECT — AI self-reflection on performance gaps
12. EVOLVE — push improvements to GitHub → auto-deploy

### Layer 4: Data (Supabase)
- agent_memory, agent_sessions, agent_audit_log
- xps_companies, call_logs, daily_briefings
- apex_runs, ghost_runs, generated_files, test_results
- test_memory, test_run_summaries, test_regressions
- workflow_runs, capabilities_benchmarks, approval_queue

## GOVERNANCE
5-Level Autonomy Matrix:
- L1 (Auto): Memory reads, status checks, reports
- L2 (Auto): Lead discovery, scoring, storage, analysis
- L3 (Auto): Outreach drafts, code generation, docs
- L4 (Approve): External sends, payments, public deployments
- L5 (Jeremy only): System architecture changes, API key rotation

## FAANG TARGET METRICS
- Validator Score: ≥ 95% (currently tracking)
- All 30 capabilities: Active
- Cron reliability: ≥ 99%
- Memory persistence: 100%
- Lead discovery: ≥ 50 leads/day
- Response latency: < 2s p95
