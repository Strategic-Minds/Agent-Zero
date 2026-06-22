-- ═══════════════════════════════════════════════════════════
-- TEST MEMORY SYSTEM — Full schema
-- ═══════════════════════════════════════════════════════════

-- Individual test result log (every single run)
create table if not exists test_results_log (
  id uuid primary key default gen_random_uuid(),
  test_id text not null,
  test_name text,
  severity text default 'medium',
  status text,
  score integer,
  passed boolean,
  details text,
  error text,
  latency_ms integer,
  deployment_url text,
  commit_sha text,
  timestamp timestamptz not null,
  run_id text,
  created_at timestamptz default now()
);

create index if not exists idx_trl_test_id on test_results_log(test_id);
create index if not exists idx_trl_run_id on test_results_log(run_id);
create index if not exists idx_trl_timestamp on test_results_log(timestamp desc);
create index if not exists idx_trl_passed on test_results_log(passed);

-- Persistent test memory (one row per test_id — rolling aggregates)
create table if not exists test_memory (
  id uuid primary key default gen_random_uuid(),
  test_id text not null unique,
  test_name text,
  severity text default 'medium',
  total_runs integer default 0,
  total_passes integer default 0,
  total_fails integer default 0,
  pass_rate numeric(4,3) default 0,
  avg_score numeric(5,1) default 0,
  avg_latency_ms integer default 0,
  last_status text,
  last_score integer,
  last_run_at timestamptz,
  last_pass_at timestamptz,
  last_fail_at timestamptz,
  is_flaky boolean default false,
  flaky_since timestamptz,
  consecutive_passes integer default 0,
  consecutive_fails integer default 0,
  known_failure_pattern text,
  known_fix text,
  fix_applied_at timestamptz,
  last_details text,
  last_error text,
  last_deployment_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_tm_test_id on test_memory(test_id);
create index if not exists idx_tm_severity on test_memory(severity);
create index if not exists idx_tm_is_flaky on test_memory(is_flaky);
create index if not exists idx_tm_pass_rate on test_memory(pass_rate);

-- Full run summaries (one row per validator run)
create table if not exists test_run_summaries (
  id uuid primary key default gen_random_uuid(),
  run_id text not null unique,
  deployment_url text,
  commit_sha text,
  timestamp timestamptz not null,
  total_tests integer default 0,
  passed integer default 0,
  failed integer default 0,
  flaky integer default 0,
  overall_score numeric(5,1),
  faang_grade text,
  critical_failures integer default 0,
  regressions jsonb default '[]',
  improvements jsonb default '[]',
  new_flaky jsonb default '[]',
  duration_ms integer,
  status text,
  created_at timestamptz default now()
);

create index if not exists idx_trs_timestamp on test_run_summaries(timestamp desc);
create index if not exists idx_trs_status on test_run_summaries(status);

-- Regression tracking
create table if not exists test_regressions (
  id uuid primary key default gen_random_uuid(),
  test_id text not null,
  test_name text,
  deployment_url text,
  previous_consecutive_passes integer,
  current_error text,
  detected_at timestamptz default now(),
  resolved boolean default false,
  resolved_at timestamptz
);

create index if not exists idx_tr_test_id on test_regressions(test_id);
create index if not exists idx_tr_resolved on test_regressions(resolved);
