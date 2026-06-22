-- APEX Agent Schema Extension
-- Run in Supabase SQL editor after 001_agent_zero_schema.sql

-- APEX Runs — stores every full clone/analyze run
CREATE TABLE IF NOT EXISTS apex_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id TEXT NOT NULL UNIQUE,
  target_url TEXT,
  niche TEXT,
  mode TEXT NOT NULL DEFAULT 'enhance',
  sites_analyzed INTEGER DEFAULT 0,
  files_generated INTEGER DEFAULT 0,
  healed_issues INTEGER DEFAULT 0,
  blueprints_json JSONB DEFAULT '[]',
  test_results_json JSONB DEFAULT '[]',
  doc_content TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'complete', 'failed')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ghost Runs — stores GHOST agent crawl/clone runs
CREATE TABLE IF NOT EXISTS ghost_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  target_url TEXT NOT NULL,
  approach TEXT NOT NULL DEFAULT 'enhanced_clone',
  industry TEXT,
  niche TEXT,
  pages_crawled INTEGER DEFAULT 0,
  weaknesses_found INTEGER DEFAULT 0,
  opportunities_found INTEGER DEFAULT 0,
  intelligence_json JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'complete',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated Files — stores all AI-generated code files
CREATE TABLE IF NOT EXISTS generated_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id TEXT NOT NULL,
  run_type TEXT NOT NULL DEFAULT 'apex', -- 'apex' | 'ghost'
  file_path TEXT NOT NULL,
  file_content TEXT NOT NULL,
  language TEXT DEFAULT 'ts',
  lines INTEGER DEFAULT 0,
  test_status TEXT DEFAULT 'untested', -- 'untested' | 'pass' | 'fail' | 'healed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test Results — per-file, per-category test outcomes
CREATE TABLE IF NOT EXISTS test_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id TEXT NOT NULL,
  file_path TEXT,
  category TEXT NOT NULL,
  test_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'warning')),
  detail TEXT,
  fix TEXT,
  auto_fixed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Site Blueprints — detailed intelligence per site analyzed
CREATE TABLE IF NOT EXISTS site_blueprints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id TEXT,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  overall_score INTEGER,
  industry TEXT,
  niche TEXT,
  estimated_mrr TEXT,
  estimated_traffic TEXT,
  tech_stack TEXT[],
  blueprint_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_apex_runs_status ON apex_runs(status);
CREATE INDEX IF NOT EXISTS idx_apex_runs_niche ON apex_runs(niche);
CREATE INDEX IF NOT EXISTS idx_apex_runs_started ON apex_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ghost_runs_url ON ghost_runs(target_url);
CREATE INDEX IF NOT EXISTS idx_generated_files_run ON generated_files(run_id);
CREATE INDEX IF NOT EXISTS idx_test_results_run ON test_results(run_id);
CREATE INDEX IF NOT EXISTS idx_test_results_status ON test_results(status);
CREATE INDEX IF NOT EXISTS idx_blueprints_domain ON site_blueprints(domain);

-- RLS: service role only
ALTER TABLE apex_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghost_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON apex_runs FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON ghost_runs FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON generated_files FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON test_results FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON site_blueprints FOR ALL TO service_role USING (true);
