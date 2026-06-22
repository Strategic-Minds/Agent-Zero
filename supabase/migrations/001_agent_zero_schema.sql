-- Agent-Zero Master Schema
-- Run this in your Supabase SQL editor

-- Agent Memory Table (persistent long-term memory)
CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  session_id TEXT,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('episodic', 'semantic', 'procedural', 'working')),
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  tags TEXT[] DEFAULT '{}',
  importance INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, key)
);

-- Agent Sessions Table (continuity / dehydrate-rehydrate)
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL UNIQUE,
  phase TEXT NOT NULL DEFAULT 'PHASE-1',
  step TEXT NOT NULL DEFAULT 'STEP-1',
  context JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'complete', 'blocked')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Audit Log (governance / approval trail)
CREATE TABLE IF NOT EXISTS agent_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  action TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level BETWEEN 0 AND 4),
  status TEXT NOT NULL CHECK (status IN ('allowed', 'blocked', 'pending_approval', 'approved', 'executed')),
  details JSONB DEFAULT '{}',
  requires_approval BOOLEAN DEFAULT FALSE,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approval Queue (gates for level 3 and 4 actions)
CREATE TABLE IF NOT EXISTS approval_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  level INTEGER NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  notes TEXT,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- XPS Companies (lead database)
CREATE TABLE IF NOT EXISTS xps_companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id TEXT UNIQUE,
  company_name TEXT NOT NULL,
  entity_type TEXT,
  entity_status TEXT,
  city TEXT,
  county TEXT,
  state TEXT DEFAULT 'AZ',
  phone TEXT,
  email TEXT,
  website_url TEXT,
  linkedin_link TEXT,
  maps_link TEXT,
  registry_link TEXT,
  formation_date TEXT,
  age_bucket TEXT,
  category_guess TEXT,
  adjacency_class TEXT,
  source_type TEXT,
  raw_notes TEXT,
  possible_duplicate BOOLEAN DEFAULT FALSE,
  operator_notes TEXT,
  hubspot_company_id TEXT,
  lead_score INTEGER DEFAULT 0,
  priority_tier TEXT,
  ai_profile_summary TEXT,
  ai_pitch_recommendation TEXT,
  ai_next_action TEXT,
  last_enriched_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Call Logs
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES xps_companies(id),
  company_name TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  call_date TIMESTAMPTZ,
  call_duration_minutes INTEGER,
  call_outcome TEXT,
  call_notes TEXT,
  next_action TEXT,
  next_action_date TIMESTAMPTZ,
  hubspot_activity_id TEXT,
  calendar_event_id TEXT,
  ai_call_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Briefings (ARIA morning reports)
CREATE TABLE IF NOT EXISTS daily_briefings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  briefing_date DATE NOT NULL UNIQUE,
  content TEXT NOT NULL,
  leads_discovered INTEGER DEFAULT 0,
  leads_scored INTEGER DEFAULT 0,
  outreach_sent INTEGER DEFAULT 0,
  meetings_booked INTEGER DEFAULT 0,
  revenue_pipeline NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_memory_agent_id ON agent_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_tags ON agent_memory USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_audit_log_agent_id ON agent_audit_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_status ON agent_audit_log(status);
CREATE INDEX IF NOT EXISTS idx_approval_queue_status ON approval_queue(status);
CREATE INDEX IF NOT EXISTS idx_xps_companies_state ON xps_companies(state);
CREATE INDEX IF NOT EXISTS idx_xps_companies_lead_score ON xps_companies(lead_score DESC);

-- RLS Policies
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE xps_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_briefings ENABLE ROW LEVEL SECURITY;

-- Service role bypass (agents use service role key)
CREATE POLICY "service_role_all" ON agent_memory FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON agent_sessions FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON agent_audit_log FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON approval_queue FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON xps_companies FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON call_logs FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON daily_briefings FOR ALL TO service_role USING (true);
