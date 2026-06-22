-- Agent Zero Enterprise Tables v2
-- Run in Supabase SQL Editor

-- Swarm Jobs
CREATE TABLE IF NOT EXISTS swarm_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id TEXT UNIQUE NOT NULL,
  task_count INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  success_rate INTEGER DEFAULT 0,
  strategy TEXT DEFAULT 'parallel',
  duration_ms INTEGER DEFAULT 0,
  results JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WhatsApp Broadcasts
CREATE TABLE IF NOT EXISTS whatsapp_broadcasts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  total INTEGER DEFAULT 0,
  sent INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  segment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WhatsApp Messages
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT UNIQUE NOT NULL,
  from_number TEXT,
  to_number TEXT,
  message TEXT,
  direction TEXT CHECK (direction IN ('inbound','outbound')),
  status TEXT DEFAULT 'delivered',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Benchmark Runs (if not exists)
CREATE TABLE IF NOT EXISTS benchmark_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id TEXT UNIQUE NOT NULL,
  score INTEGER NOT NULL,
  tier TEXT NOT NULL,
  passed INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  total INTEGER NOT NULL,
  deployable BOOLEAN DEFAULT false,
  category_scores JSONB DEFAULT '{}'::jsonb,
  dimension_scores JSONB DEFAULT '{}'::jsonb,
  model TEXT DEFAULT 'llama-3.1-8b-instant',
  triggered_by TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_swarm_jobs_created ON swarm_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_from ON whatsapp_messages(from_number);
CREATE INDEX IF NOT EXISTS idx_benchmark_score ON benchmark_runs(score DESC);
CREATE INDEX IF NOT EXISTS idx_benchmark_created ON benchmark_runs(created_at DESC);

-- Score trend view
CREATE OR REPLACE VIEW benchmark_trend AS
SELECT
  date_trunc('day', created_at) AS day,
  ROUND(AVG(score), 1) AS avg_score,
  MAX(score) AS best_score,
  COUNT(*) AS runs
FROM benchmark_runs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY 1 ORDER BY 1 DESC;

SELECT 'Enterprise tables created' AS status;
