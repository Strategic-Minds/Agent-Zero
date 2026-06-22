create table if not exists audit_reports (
  id uuid primary key default gen_random_uuid(),
  audit_id text not null unique,
  subject_name text,
  subject_url text,
  overall_score integer,
  faang_grade text,
  tier text,
  cleared_for_production boolean,
  p0_count integer,
  p1_count integer,
  dimension_scores jsonb,
  full_report jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_ar_audit_id on audit_reports(audit_id);
create index if not exists idx_ar_created on audit_reports(created_at desc);
create index if not exists idx_ar_score on audit_reports(overall_score desc);
