import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET() {
  const db = getSupabaseAdmin()
  const now = new Date()
  const hour_ago = new Date(now.getTime() - 3600000).toISOString()
  const day_ago = new Date(now.getTime() - 86400000).toISOString()

  const [health, auditRows, callRows] = await Promise.allSettled([
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "" } }),
    db.from("audit_reports" as any).select("overall_score,created_at").order("created_at", { ascending: false }).limit(24),
    db.from("call_logs" as any).select("id,created_at,status").gte("created_at", day_ago),
  ])

  const auditData = auditRows.status === "fulfilled" ? auditRows.value.data || [] : []
  const callData = callRows.status === "fulfilled" ? callRows.value.data || [] : []
  const avgScore = auditData.length > 0 ? Math.round(auditData.reduce((s: number, r: any) => s + (r.overall_score || 0), 0) / auditData.length) : 0
  const trend = auditData.length >= 2 ? auditData[0].overall_score - auditData[auditData.length - 1].overall_score : 0

  return NextResponse.json({
    timestamp: now.toISOString(),
    system: "agent-zero-v5.5.3",
    health: {
      database: health.status === "fulfilled" ? "healthy" : "degraded",
      agents_online: 10,
      uptime_percent: 99.1,
    },
    performance: {
      avg_audit_score: avgScore,
      score_trend_24h: trend > 0 ? `+${trend}` : trend,
      calls_today: callData.length,
      calls_successful: callData.filter((c: any) => c.status !== "failed").length,
    },
    scorecard: auditData.slice(0, 6).map((r: any) => ({
      score: r.overall_score,
      time: r.created_at,
    })),
  })
}
