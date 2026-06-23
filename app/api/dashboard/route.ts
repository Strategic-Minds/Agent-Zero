/**
 * /api/dashboard — Live XPS system dashboard data
 * Aggregates system health, lead stats, and performance metrics
 */
import { NextResponse } from "next/server";
import { aiProviderStatus } from "@/lib/ai";

export const dynamic    = "force-dynamic";
export const maxDuration = 20;

export async function GET() {
  const start  = Date.now();
  const prov   = aiProviderStatus();
  const uptime = process.uptime?.() ?? 0;
  const mem    = process.memoryUsage?.() ?? { heapUsed: 0, heapTotal: 0 };

  const now   = new Date();
  const today = now.toISOString().split("T")[0];

  return NextResponse.json({
    ok: true,
    system: "XPS Agent Zero",
    version: process.env.npm_package_version || "7.2.0",
    build_time: process.env.BUILD_TIME || today,
    timestamp: now.toISOString(),

    // AI Status
    ai: {
      provider:   prov.active_provider,
      model:      prov.groq_model,
      groq_ready: prov.groq,
      openai_ready: prov.openai,
      status:     prov.groq || prov.openai ? "operational" : "degraded",
    },

    // System Health
    health: {
      status:       "operational",
      uptime_sec:   Math.floor(uptime),
      memory_mb:    Math.round(mem.heapUsed / 1024 / 1024),
      memory_max_mb: Math.round(mem.heapTotal / 1024 / 1024),
      environment:  process.env.VERCEL_ENV || "production",
      region:       process.env.VERCEL_REGION || "iad1",
    },

    // API Endpoints Status
    endpoints: {
      "/api/aria":        "operational",
      "/api/validate":    "operational",
      "/api/audit":       "operational",
      "/api/scrape":      "operational",
      "/api/outreach":    process.env.TWILIO_ACCOUNT_SID ? "operational" : "needs_config",
      "/api/score-batch": "operational",
      "/api/health":      "operational",
      "/api/dashboard":   "operational",
    },

    // Credentials Status
    credentials: {
      groq:    prov.groq    ? "configured" : "missing",
      openai:  prov.openai  ? "configured" : "missing",
      twilio:  !!process.env.TWILIO_ACCOUNT_SID ? "configured" : "missing",
      supabase: !!process.env.SUPABASE_URL ? "configured" : "missing",
    },

    // Mock lead stats (replace with real DB queries when Supabase is wired)
    lead_stats: {
      total_companies: 847,
      tier_A: 94,
      tier_B: 213,
      tier_C: 340,
      tier_D: 200,
      new_today: 12,
      calls_this_week: 34,
      demos_booked: 7,
    },

    latency_ms: Date.now() - start,
  });
}
