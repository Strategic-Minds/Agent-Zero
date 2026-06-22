# API REFERENCE — ALL ENDPOINTS
# Builder Doc 07 | Complete Route Catalog

## PUBLIC ROUTES (no auth)
GET  /api/health          — System health + version
GET  /api/benchmark       — Capability benchmark scores
GET  /api/orchestrate     — Agent registry + ChatGPT schema
GET  /api/openai-setup    — ChatGPT Custom GPT configuration

## ARIA CHAT (session auth)
POST /api/aria            — Chat with ARIA
  Body: { message, channel?, session_id? }
  Channels: web | studio | whatsapp | orchestrator

## ORCHESTRATION (x-chatgpt-action or CRON_SECRET)
POST /api/orchestrate     — Fan out to all relevant agents
  Body: { task, agents?[], session_id? }
POST /api/swarm           — Parallel swarm execution
  Body: { tasks:[], job_name?, notify? }
POST /api/workflows       — Run a named workflow
  Body: { workflow_id, trigger_data? }

## VALIDATION (CRON_SECRET)
POST /api/validate        — Full 30-test validation
GET  /api/test-memory     — Test history + health (?view=health|all|history|flaky)
POST /api/test-memory     — Resolve regression (?action=resolve_regression)

## AUTONOMOUS AGENTS (BRIDGE_SECRET)
POST /api/apex            — APEX agent commands
  Commands: run|analyze|discover|test|heal|status
POST /api/ghost           — GHOST agent commands
  Commands: analyze|clone|niches|status
POST /api/bridge          — Cross-service operations
  Commands: push_code|deploy|read_file|write_file

## CRON ROUTES (Vercel Cron — auto-triggered)
GET  /api/cron/auto-loop          — */5 — Master 12-stage loop
GET  /api/cron/auto-validate      — */30 — Triple validation
GET  /api/cron/auto-heal          — */15 — Capability healing
GET  /api/cron/lead-discovery     — 0 6 * * * — Lead scraping
GET  /api/cron/lead-scoring       — 0 7 * * * — AI scoring
GET  /api/cron/outreach-followup  — 0 9 * * 1-5 — Outreach
GET  /api/cron/daily-briefing     — 0 8 * * * — Briefing
GET  /api/cron/weekly-report      — 0 8 * * 1 — Report
GET  /api/cron/benchmark          — 0 3 * * * — Nightly bench
GET  /api/cron/auto-install       — 0 2 * * * — Install caps

## UI PAGES
/              — Orchestration dashboard
/studio        — ARIA studio (creative builds)
/chat          — Chat interface
/dashboard     — CRM + pipeline overview
/workflows     — Workflow runner
/capabilities  — 30-capability registry
/benchmark     — Benchmark scores
/test-memory   — Test history dashboard
