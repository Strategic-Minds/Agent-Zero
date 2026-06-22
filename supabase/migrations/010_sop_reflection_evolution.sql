-- SOP Events (every agent action)
create table if not exists sop_events (
  id uuid primary key default gen_random_uuid(),
  event_id text unique not null,
  event_type text,
  agent text,
  action text,
  input_summary text,
  output_summary text,
  success boolean default true,
  duration_ms integer default 0,
  score_impact integer,
  metadata jsonb,
  timestamp timestamptz default now()
);
create index if not exists idx_sop_timestamp on sop_events(timestamp desc);
create index if not exists idx_sop_agent on sop_events(agent);
create index if not exists idx_sop_type on sop_events(event_type);

-- Reflection Reports (every 4hrs)
create table if not exists reflection_reports (
  id uuid primary key default gen_random_uuid(),
  reflection_id text unique not null,
  timestamp timestamptz default now(),
  period_hours integer,
  current_audit_score integer,
  current_faang_grade text,
  test_pass_rate integer,
  sop_summary jsonb,
  honest_assessment text,
  what_worked jsonb,
  what_failed jsonb,
  patterns_detected jsonb,
  priority_next_actions jsonb,
  evolution_needed boolean,
  evolution_urgency text,
  suggested_builder_focus text,
  created_at timestamptz default now()
);
create index if not exists idx_rr_timestamp on reflection_reports(timestamp desc);

-- Evolution Plans
create table if not exists evolution_plans (
  id uuid primary key default gen_random_uuid(),
  evolution_id text unique not null,
  based_on_audit_score integer,
  target_score integer,
  gap integer,
  priority_fixes jsonb,
  builder_doc text,
  files_planned integer,
  expected_new_score integer,
  status text default 'planned',
  created_at timestamptz default now()
);
create index if not exists idx_ep_created on evolution_plans(created_at desc);
