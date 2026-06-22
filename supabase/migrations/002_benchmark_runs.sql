-- Agent Zero Enterprise Benchmark History
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS benchmark_runs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id          TEXT UNIQUE NOT NULL,
  score           INTEGER NOT NULL,
  tier            TEXT NOT NULL,
  passed          INTEGER NOT NULL,
  failed          INTEGER NOT NULL,
  total           INTEGER NOT NULL,
  deployable      BOOLEAN DEFAULT false,
  category_scores JSONB DEFAULT '{}'::jsonb,
  dimension_scores JSONB DEFAULT '{}'::jsonb,
  model           TEXT DEFAULT 'llama-3.1-8b-instant',
  triggered_by    TEXT DEFAULT 'manual',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast score trending
CREATE INDEX IF NOT EXISTS benchmark_runs_created_at ON benchmark_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS benchmark_runs_score ON benchmark_runs(score DESC);

-- View: score trend (last 30 days)
CREATE OR REPLACE VIEW benchmark_trend AS
SELECT
  date_trunc('day', created_at) AS day,
  ROUND(AVG(score), 1) AS avg_score,
  MAX(score) AS best_score,
  MIN(score) AS worst_score,
  COUNT(*) AS runs
FROM benchmark_runs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1 DESC;

-- Enable Row Level Security (admins only)
ALTER TABLE benchmark_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Service role full access" ON benchmark_runs USING (true) WITH CHECK (true);

SELECT 'benchmark_runs table created' AS status;
