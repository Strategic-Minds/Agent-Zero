-- Agent Zero — Capabilities & Benchmark Schema
-- Run this in your Supabase SQL editor

-- Capability registry (all 30 capabilities)
create table if not exists capability_registry (
  id integer primary key,
  name text not null,
  category text not null,
  benchmark text,
  target_score integer,
  current_score integer default 0,
  status text default 'pending',
  description text,
  auto_installed boolean default false,
  last_verified timestamptz,
  created_at timestamptz default now()
);

-- Benchmark runs (one per nightly run)
create table if not exists benchmark_runs (
  run_id text primary key,
  started_at timestamptz,
  completed_at timestamptz,
  total_capabilities integer,
  active_count integer,
  avg_score numeric,
  avg_target numeric,
  gpa numeric,
  top_gaps text[],
  created_at timestamptz default now()
);

-- Benchmark results (per capability per run)
create table if not exists benchmark_results (
  id uuid primary key default gen_random_uuid(),
  run_id text references benchmark_runs(run_id),
  capability_id integer references capability_registry(id),
  capability_name text,
  category text,
  score integer,
  target integer,
  status text,
  notes text,
  tested_at timestamptz,
  created_at timestamptz default now()
);

-- Install logs
create table if not exists install_logs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz,
  total_capabilities integer,
  installed integer,
  verified integer,
  failed integer,
  results jsonb,
  created_at timestamptz default now()
);

-- Memory entries (for long-term memory capability #13)
create table if not exists memory_entries (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  content text,
  embedding vector(1536),
  metadata jsonb,
  created_at timestamptz default now()
);

-- Enable pgvector if not already
create extension if not exists vector;

-- Indexes
create index if not exists idx_benchmark_results_run on benchmark_results(run_id);
create index if not exists idx_benchmark_results_cap on benchmark_results(capability_id);
create index if not exists idx_capability_status on capability_registry(status);
create index if not exists idx_memory_session on memory_entries(session_id);
