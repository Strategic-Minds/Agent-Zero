import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function GET() {
  const uptimeSec = Math.floor(process.uptime ? process.uptime() : 0);
  return NextResponse.json({
    status: "ok",
    version: "6.3.4",
    uptime: uptimeSec,
    uptime_human: uptimeSec + "s",
    environment: process.env.NODE_ENV || "production",
    timestamp: new Date().toISOString(),
    features: {
      ai_scoring: !!(process.env.VERCEL_OIDC_TOKEN || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY),
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
    },
  });
}
