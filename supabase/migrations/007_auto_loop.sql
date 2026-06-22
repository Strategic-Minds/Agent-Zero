-- AUTO LOOP STATE
create table if not exists auto_loop_state (
  cycle_id text primary key,
  stage text,
  status text,
  score_before integer default 0,
  score_after integer default 0,
  patches_applied integer default 0,
  capabilities_healed integer default 0,
  started_at timestamptz,
  stage_started_at timestamptz,
  stage_log jsonb,
  error text,
  updated_at timestamptz default now()
);

-- LOOP HISTORY (every completed cycle)
create table if not exists loop_history (
  id uuid primary key default gen_random_uuid(),
  cycle_id text not null,
  timestamp timestamptz default now(),
  stages jsonb,
  total_duration_ms integer
);

-- LOOP STAGE LOG (every individual stage)
create table if not exists loop_stage_log (
  id uuid primary key default gen_random_uuid(),
  cycle_id text not null,
  stage text,
  status text,
  output jsonb,
  duration_ms integer,
  log jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_lsl_cycle on loop_stage_log(cycle_id);
create index if not exists idx_lsl_stage on loop_stage_log(stage);
create index if not exists idx_lh_timestamp on loop_history(timestamp desc);
