/**
 * Health Check v2 — /api/health
 * Returns complete system status including all env vars and agent states
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
  const status = passing >= 6 ? "healthy" : "degraded"
  return NextResponse.json({
    status,
    version: "2.0.0",
    agents: ["ARIA v2.0","APEX v2.0","GHOST v1.0","DISCOVERY v1.0","OUTREACH v1.0","INTELLIGENCE v1.0"],
    checks,
    env_score: `${passing}/${total}`,
    uptime: process.uptime(), timestamp: new Date().toISOString(),
  })
}
