# AGENT REGISTRY — ALL ACTIVE AGENTS
# Builder Doc 04 | Current Agent Roster + Capabilities

## CORE AGENTS

### ARIA (Autonomous Reasoning & Intelligence Agent)
- Model: Groq Llama 3.1 8B (fast) → Llama 3.3 70B (reasoning)
- Channels: web, studio, whatsapp, orchestrator
- Memory: Supabase agent_memory (persistent across sessions)
- Tools: query_crm, send_whatsapp, search_memory, get_briefing
- Endpoint: POST /api/aria { message, channel, session_id }

### APEX (Autonomous Programming & Execution Agent)
- Model: GPT-4o / Claude 3.5 Sonnet (best for coding)
- Capabilities: code generation, bug fixing, GitHub push, Vercel deploy
- Endpoint: POST /api/apex (auth: Bearer BRIDGE_SECRET)
- Auto-triggers: on test failure, on benchmark drop

### GHOST (Global Headless Operations & Site Tracker)
- Model: Groq 70B + fetch() for real HTTP requests
- Capabilities: site analysis, competitor intel, contact extraction
- Endpoint: POST /api/ghost (auth: Bearer BRIDGE_SECRET)

### Discovery Agent
- Model: Groq 70B with real web fetch
- Target: ≥50 leads/day from Arizona epoxy contractors
- Sources: Google Search, Yellow Pages, BBB, AZ Corp Commission
- Endpoint: GET /api/cron/lead-discovery

### Intelligence Agent
- Model: GPT-4o-mini
- Scores: 0-100 lead quality score
- Profiles: company size, fit, priority tier
- Endpoint: GET /api/cron/lead-scoring

### Outreach Agent
- Model: GPT-4o (best for persuasive writing)
- Output: personalized pitch + follow-up sequence
- Endpoint: GET /api/cron/outreach-followup

### Validator Agent
- Tests: 30 FAANG-grade tests across 6 categories
- Memory: Full history in test_memory Supabase table
- Endpoint: POST /api/validate
- Triple-check: runs 3x, all must pass critical tests

### Swarm Orchestrator
- Parallel: Up to 20 concurrent agent tasks
- Pattern: Fan-out → parallel execution → merge
- Dependency: DAG-based task ordering
- Endpoint: POST /api/swarm

## PLANNED AGENTS (Phase 2)
- FORGE: Document + proposal generation agent
- SCOUT: Real-time market monitoring agent
- HERALD: Multi-channel communication agent
- ATLAS: Geographic lead mapping agent
