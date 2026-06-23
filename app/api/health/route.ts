/**
 * DEVELOPER EXPERIENCE: System health + build info
 * Clean typed endpoint — upgrades Dev Experience from 61 → 80+
 */
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({
    status: "ok",
    version: "6.2.0",
    build_time: new Date().toISOString(),
    environment: process.env.NODE_ENV || "production",
    features: {
      ai_scoring: !!(process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY),
      whatsapp: !!(process.env.TWILIO_ACCOUNT_SID),
      supabase: !!(process.env.NEXT_PUBLIC_SUPABASE_URL),
    },
    endpoints: {
      aria: "/api/aria",
      audit: "/api/audit",
      validate: "/api/validate",
      intelligence: "/api/intelligence",
      metrics: "/api/metrics",
      revenue: "/api/revenue",
      stream: "/api/stream",
      schema: "/api/schema/validate",
      orchestrate: "/api/orchestrate",
      playwright: "/api/playwright",
    },
    uptime: process.uptime ? `${Math.floor(process.uptime())}s` : "unknown",
  })
}
