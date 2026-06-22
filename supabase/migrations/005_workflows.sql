-- Workflow runs table
create table if not exists workflow_runs (
  run_id text primary key,
  workflow_id text not null,
  workflow_name text,
  status text default 'pending',
  trigger text,
  started_at timestamptz,
  completed_at timestamptz,
  steps_total integer default 0,
  steps_completed integer default 0,
  steps_failed integer default 0,
  output jsonb,
  error text,
  created_at timestamptz default now()
);

create index if not exists idx_workflow_runs_id on workflow_runs(workflow_id);
create index if not exists idx_workflow_runs_status on workflow_runs(status);
create index if not exists idx_workflow_runs_started on workflow_runs(started_at desc);
