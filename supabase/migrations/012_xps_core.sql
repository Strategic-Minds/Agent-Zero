CREATE TABLE IF NOT EXISTS leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text,
  phone text,
  email text,
  website text,
  address text,
  city text,
  state text DEFAULT 'AZ',
  industry text,
  category text,
  lead_score integer DEFAULT 0,
  status text DEFAULT 'new',
  source text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scrape_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  industry text,
  topics text[],
  location text,
  total_found integer DEFAULT 0,
  new_leads integer DEFAULT 0,
  duplicates_skipped integer DEFAULT 0,
  status text DEFAULT 'running',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  notes text
);

CREATE TABLE IF NOT EXISTS self_reflection_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  run_at timestamptz DEFAULT now(),
  diagnose_score integer,
  analyze_score integer,
  fix_score integer,
  heal_score integer,
  harden_score integer,
  optimize_score integer,
  overall_score integer,
  issues_found integer DEFAULT 0,
  issues_fixed integer DEFAULT 0,
  report jsonb,
  status text DEFAULT 'complete'
);
