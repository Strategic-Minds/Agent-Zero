import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const REQUIRED_TABLES = ["companies", "call_logs", "scrape_runs", "audit_reports", "evolution_log", "agent_state"]
const REQUIRED_COMPANY_FIELDS = ["company_name", "phone", "email", "lead_score", "city", "state"]

export async function GET() {
  const db = getSupabaseAdmin()
  const results: Record<string, { exists: boolean; row_count?: number; missing_fields?: string[] }> = {}

  for (const table of REQUIRED_TABLES) {
    try {
      const { data, error } = await db.from(table as any).select("*").limit(1)
      if (error) {
        results[table] = { exists: false }
      } else {
        const row = data?.[0] || {}
        const missing = table === "companies" ? REQUIRED_COMPANY_FIELDS.filter(f => !(f in row)) : []
        const { count } = await db.from(table as any).select("*", { count: "exact", head: true })
        results[table] = { exists: true, row_count: count || 0, missing_fields: missing.length ? missing : undefined }
      }
    } catch { results[table] = { exists: false } }
  }

  const all_ok = Object.values(results).every(r => r.exists)
  return NextResponse.json({
    schema_valid: all_ok,
    tables: results,
    score: Math.round((Object.values(results).filter(r => r.exists).length / REQUIRED_TABLES.length) * 100),
    timestamp: new Date().toISOString(),
  })
}
