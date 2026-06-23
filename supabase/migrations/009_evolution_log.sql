-- Migration 009: evolution_log table for recursive gap tracking
CREATE TABLE IF NOT EXISTS evolution_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gap_id TEXT UNIQUE NOT NULL,
  dimension TEXT,
  action TEXT,
  status TEXT DEFAULT 'pending',
  score_gain INTEGER DEFAULT 0,
  run_id TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- index for fast gap lookups
CREATE INDEX IF NOT EXISTS idx_evolution_log_gap_id ON evolution_log(gap_id);
CREATE INDEX IF NOT EXISTS idx_evolution_log_status ON evolution_log(status);

-- Allow service role full access
ALTER TABLE evolution_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON evolution_log FOR ALL TO service_role USING (true) WITH CHECK (true);
