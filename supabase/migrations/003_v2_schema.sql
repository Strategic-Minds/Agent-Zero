-- Agent Zero v2.0 Schema Additions
-- Run in Supabase SQL editor

-- Agent sessions table (for rehydrate/dehydrate lifecycle)
CREATE TABLE IF NOT EXISTS agent_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'active',
  step TEXT NOT NULL DEFAULT '1',
  context JSONB DEFAULT '{}'::jsonb,
  status TEXT CHECK (status IN ('active','paused','complete','blocked')) DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Connector tokens (OAuth storage)
CREATE TABLE IF NOT EXISTS connector_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_type TEXT NOT NULL UNIQUE,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scopes TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook events log
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_memory_agent_id ON agent_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_key ON agent_memory(key);
CREATE INDEX IF NOT EXISTS idx_agent_actions_agent_id ON agent_actions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_created ON agent_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_companies_score ON companies(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_companies_tier ON companies(priority_tier);

-- agent_memory unique constraint (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_memory_agent_id_key_key') THEN
    ALTER TABLE agent_memory ADD CONSTRAINT agent_memory_agent_id_key_key UNIQUE (agent_id, key);
  END IF;
END $$;
