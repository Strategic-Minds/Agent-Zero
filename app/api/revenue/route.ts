import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET() {
  const db = getSupabaseAdmin()

  const [companies, calls] = await Promise.allSettled([
    db.from("companies" as any).select("lead_score,priority_tier,ai_next_action,city,state").limit(500),
    db.from("call_logs" as any).select("call_outcome,call_date").limit(200),
  ])

  const co_data = companies.status === "fulfilled" ? companies.value.data || [] : []
  const ca_data = calls.status === "fulfilled" ? calls.value.data || [] : []

  const tier_a = co_data.filter((c: any) => c.priority_tier === "A").length
  const tier_b = co_data.filter((c: any) => c.priority_tier === "B").length
  const hot = co_data.filter((c: any) => c.ai_next_action === "CALL_NOW").length
  const avg_score = co_data.length > 0
    ? Math.round(co_data.reduce((s: number, c: any) => s + (c.lead_score || 0), 0) / co_data.length)
    : 0

  // Revenue model: XPS avg contract $15k, close rate ~12%
  const pipeline_value = Math.round(tier_a * 15000 * 0.12 + tier_b * 15000 * 0.06)
  const won = ca_data.filter((c: any) => c.call_outcome === "won" || c.call_outcome === "closed").length
  const revenue_won = won * 15000

  return NextResponse.json({
    pipeline: { tier_a, tier_b, hot_leads: hot, total_leads: co_data.length, avg_score },
    revenue: {
      pipeline_value_usd: pipeline_value,
      revenue_closed_usd: revenue_won,
      deals_won: won,
      avg_contract_value: 15000,
      close_rate_assumption: "12% tier A, 6% tier B",
    },
    calls: { total: ca_data.length, won },
    timestamp: new Date().toISOString(),
  })
}
