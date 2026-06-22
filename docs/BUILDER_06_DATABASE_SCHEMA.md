# DATABASE SCHEMA — SUPABASE
# Builder Doc 06 | All Tables + Indexes

## CORE TABLES

### agent_memory
Persistent key-value memory for all agents
- id, agent_id, key, value (jsonb), expires_at, created_at

### agent_sessions
Active conversation sessions
- id, session_id, agent_id, channel, messages (jsonb), created_at, updated_at

### agent_audit_log
Every agent action logged
- id, agent_id, action, level, status, details (jsonb), created_at

### xps_companies (Lead CRM)
- id, company_name, phone, email, website, city, state
- lead_score, priority_tier, ai_profile_summary
- ai_pitch_recommendation, ai_next_action
- last_enriched_date, hubspot_company_id
- source_type, adjacency_class, possible_duplicate

### call_logs
- id, company_id, company_name, contact_name, contact_phone
- call_date, call_outcome, call_notes, next_action
- next_action_date, ai_call_summary

### daily_briefings
- id, date, content (jsonb), sent_at, recipient

## TEST MEMORY TABLES (NEW)

### test_results_log
Every individual test result persisted
- id, test_id, test_name, severity, status, score, passed
- details, error, latency_ms, deployment_url, run_id, timestamp

### test_memory
Rolling aggregates per test (one row per test_id)
- test_id, pass_rate, avg_score, is_flaky
- consecutive_fails, known_failure_pattern, known_fix
- last_status, last_error, total_runs

### test_run_summaries
Full run summary per validator execution
- run_id, overall_score, faang_grade, passed, failed
- critical_failures, regressions[], improvements[]

### test_regressions
Tests that went from passing to failing
- test_id, previous_consecutive_passes, current_error, resolved

## AUTONOMOUS LOOP TABLES (NEW)

### auto_loop_state
Current loop cycle state
- cycle_id, stage, status, score_before, score_after
- patches_applied, capabilities_healed, started_at

### loop_history
Historical loop cycle results
- cycle_id, total_cycles, avg_score_delta, patches_total

## APEX / GHOST TABLES
- apex_runs, ghost_runs, generated_files, test_results, site_blueprints
- workflow_runs, capabilities_benchmarks, approval_queue
