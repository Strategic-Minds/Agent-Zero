/**
 * Health Check v3 — /api/health
 * status:"ok" always returned when system is operational
 * Includes uptime, version, agent list, env checks
 */
import { NextResponse } from "next/server"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const checks = {
    supabase_url: !!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL),
    supabase_anon_key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabase_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    groq_api_key: !!process.env.GROQ_API_KEY,
    openai_api_key: !!process.env.OPENAI_API_KEY,
    bridge_secret: !!process.env.BRIDGE_SECRET,
    github_token: !!process.env.GITHUB_TOKEN,
    github_repo: !!process.env.GITHUB_REPO,
    hubspot_api_key: !!process.env.HUBSPOT_API_KEY,
    whatsapp_token: !!process.env.WHATSAPP_BUSINESS_TOKEN,
    whatsapp_phone_id: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    owner_whatsapp: !!process.env.OWNER_WHATSAPP,
    resend_api_key: !!process.env.RESEND_API_KEY,
  }
  const passing = Object.values(checks).filter(Boolean).length
  const total = Object.keys(checks).length
  const health = passing >= 6 ? "healthy" : "degraded"
  return NextResponse.json({
    status: "ok",
    health,
    version: "5.2.8",
    uptime: process.uptime(),
    agents: [
      "ARIA v2.0", "APEX v2.0", "GHOST v2.0", "DISCOVERY v3.0",
      "OUTREACH v1.0", "INTELLIGENCE v1.0", "VALIDATOR v1.0",
      "REPORTER v1.0", "REFLECTION v1.0", "EVOLUTION v1.0", "SOP v1.0"
    ],
    checks,
    env_score: `${passing}/${total}`,
    timestamp: new Date().toISOString(),
  })
}
