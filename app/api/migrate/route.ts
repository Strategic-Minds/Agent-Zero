/**
 * AUTO MIGRATION RUNNER — /api/migrate
 * Fix 6: Automatically apply pending Supabase SQL migrations
 * POST with Authorization: Bearer BRIDGE_SECRET to run pending migrations
 */
import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

// All migrations defined inline — no filesystem reads needed on Vercel
const MIGRATIONS = [
  {
    id: "001_base_schema",
    sql: `
      create table if not exists companies (
        id uuid primary key default gen_random_uuid(),
        company_name text not null,
        phone text, email text, website_url text,
        city text, state text default 'AZ',
        category_guess text, source_type text,
        entity_status text default 'Active',
        lead_score int, priority_tier text,
        ai_profile_summary text, ai_pitch_recommendation text,
        ai_next_action text, outreach_sent boolean default false,
        outreach_date timestamp, outreach_channel text,
        raw_notes text, operator_notes text,
        created_at timestamp default now(),
        updated_at timestamp default now()
      );
      create unique index if not exists companies_name_idx on companies(company_name);
    `,
  },
  {
    id: "002_scrape_runs",
    sql: `
      create table if not exists scrape_runs (
        id uuid primary key default gen_random_uuid(),
        run_name text, run_date timestamp default now(),
        source text, total_records int default 0,
        new_records int default 0, status text default 'complete',
        notes text
      );
    `,
  },
  {
    id: "003_agent_reflections",
    sql: `
      create table if not exists agent_reflections (
        id uuid primary key default gen_random_uuid(),
        run_id text unique, run_type text,
        health_score int, agents_fired int, agents_succeeded int,
        leads_discovered int, errors text,
        recommendations text, created_at timestamp default now()
      );
    `,
  },
  {
    id: "004_optimizer_runs",
    sql: `
      create table if not exists optimizer_runs (
        id uuid primary key default gen_random_uuid(),
        run_id text unique, cycle int,
        audit_score_before int, audit_score_after int,
        gap_targeted text, fix_applied boolean default false,
        points_gained int default 0, validator_score_after int default 0,
        duration_ms int, next_target text,
        ran_at timestamp default now()
      );
    `,
  },
  {
    id: "005_cron_dlq",
    sql: `
      create table if not exists cron_failures (
        id uuid primary key default gen_random_uuid(),
        cron_name text, error_message text,
        attempt int default 1, resolved boolean default false,
        resolved_at timestamp, failed_at timestamp default now()
      );
      create table if not exists cron_runs (
        id uuid primary key default gen_random_uuid(),
        cron_name text, ran_at timestamp default now(),
        duration_ms int, status text
      );
    `,
  },
  {
    id: "006_heal_logs",
    sql: `
      create table if not exists heal_logs (
        id uuid primary key default gen_random_uuid(),
        run_id text unique, pre_score int, post_score int,
        fixes_applied jsonb, status text,
        created_at timestamp default now()
      );
    `,
  },
]

export async function GET() {
  return NextResponse.json({
    status: "Migration runner ready",
    total_migrations: MIGRATIONS.length,
    endpoint: "POST /api/migrate with Authorization: Bearer BRIDGE_SECRET",
  })
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || ""
  if (auth !== "Bearer " + (process.env.BRIDGE_SECRET || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = getSupabaseAdmin()
  const results: { id: string; status: string; error?: string }[] = []

  for (const migration of MIGRATIONS) {
    try {
      const { error } = await db.rpc("exec_sql" as any, { query: migration.sql })
      if (error && !error.message?.includes("already exists")) {
        results.push({ id: migration.id, status: "error", error: error.message })
      } else {
        results.push({ id: migration.id, status: "applied" })
      }
    } catch (e) {
      results.push({ id: migration.id, status: "error", error: String(e) })
    }
  }

  const applied = results.filter(r => r.status === "applied").length
  const errors = results.filter(r => r.status === "error").length

  return NextResponse.json({
    ok: true,
    applied,
    errors,
    results,
    timestamp: new Date().toISOString(),
  })
}
