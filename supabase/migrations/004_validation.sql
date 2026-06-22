-- Validation runs table
create table if not exists validation_runs (
  run_id text primary key,
  deployment_url text,
  started_at timestamptz,
  completed_at timestamptz,
  total_tests integer,
  passed integer,
  failed integer,
  critical_failures integer,
  overall_score numeric,
  faang_grade text,
  url_cleared boolean default false,
  triple_check_passed boolean default false,
  blocking_issues text[],
  recommendation text,
  created_at timestamptz default now()
);

create index if not exists idx_validation_url on validation_runs(deployment_url);
create index if not exists idx_validation_cleared on validation_runs(url_cleared);
