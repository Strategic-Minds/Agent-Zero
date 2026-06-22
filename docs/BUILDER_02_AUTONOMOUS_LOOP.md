# AUTONOMOUS EVOLUTION LOOP — SPEC
# Builder Doc 02 | The 12-Stage Self-Improvement Cycle

## OVERVIEW
The Auto-Loop runs every 5 minutes via Vercel Cron → Vercel Workflow.
Each stage hands context to the next. The loop is non-blocking —
if any stage fails, it logs the failure, heals itself, and continues.

## TRIGGER
- Primary: /api/cron/auto-loop (every 5 minutes: "*/5 * * * *")
- Secondary: /api/workflow POST (manual trigger)
- Tertiary: Entity change trigger (new Supabase record)

## THE 12 STAGES

### Stage 1: ANALYZE
- Pull current system health from /api/health
- Get latest benchmark score from test_memory
- Compare to target metrics (FAANG A+)
- Output: gap_report { score, gaps[], priority_fixes[] }

### Stage 2: CREATE
- For each gap in priority_fixes: generate targeted code patch
- Use APEX agent for code generation
- Use GPT-4o for architecture recommendations
- Output: patches[] { file, old_content, new_content, reason }

### Stage 3: VALIDATE (Triple-Check)
- Run full 30-test validator suite
- Run 3x in sequence — all must pass
- If any fail: flag for Stage 4
- Output: validation_result { score, failures[], cleared }

### Stage 4: FIX
- For each failure from Stage 3: apply targeted fix
- APEX generates fix code
- Push to GitHub via bridge
- Output: fixes_applied[]

### Stage 5: HEAL
- Detect degraded/inactive capabilities from capabilities registry
- Reinstall or reconfigure broken integrations
- Reset rate-limited API clients
- Output: healed_capabilities[]

### Stage 6: HARDEN
- Scan for exposed secrets in code
- Verify all endpoints require auth
- Check CORS configuration
- Validate rate limiting
- Output: hardening_report

### Stage 7: OPTIMIZE
- Identify slow endpoints (latency > 2s)
- Suggest caching for repeated queries
- Optimize DB indexes
- Output: optimization_report

### Stage 8: ENHANCE
- If score >= 95%: look for new capabilities to add
- Pull from capability roadmap
- Generate enhancement code
- Output: enhancements_planned[]

### Stage 9: TEST
- Full 30-test suite via Validator Agent
- Memory test: write + read from Supabase
- Integration test: ARIA → DB → WhatsApp chain
- Output: test_results { score, grade, cleared }

### Stage 10: DOCUMENT
- Auto-update all builder docs with current state
- Update CAPABILITIES.md with new capability statuses
- Update ENV.md if new vars needed
- Update BENCHMARK.md with latest scores
- Output: docs_updated[]

### Stage 11: REFLECT
- AI self-reflection: "What did I build? What failed? Why?"
- Compare this cycle to last 5 cycles
- Identify recurring failure patterns
- Output: reflection_summary { insights[], recurring_patterns[] }

### Stage 12: EVOLVE
- If patches from Stages 2/4: push to GitHub
- Trigger new Vercel deployment
- Update loop_state in Supabase
- Notify Jeremy if score improved or degraded
- Output: evolution_summary { deployed, score_delta, next_focus }

## LOOP STATE (Supabase: auto_loop_state)
| Field | Type | Description |
|-------|------|-------------|
| cycle_id | text | Unique cycle identifier |
| stage | text | Current stage name |
| started_at | timestamptz | Cycle start |
| stage_started_at | timestamptz | Stage start |
| score_before | int | Score entering cycle |
| score_after | int | Score exiting cycle |
| patches_applied | int | Code patches pushed |
| capabilities_healed | int | Capabilities restored |
| status | text | running/complete/failed |
