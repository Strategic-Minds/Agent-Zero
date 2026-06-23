/**
 * /api/health — Comprehensive health check with live AI ping
 */
import { NextResponse } from "next/server";
import { aiChat, aiProviderStatus } from "@/lib/ai";

export const dynamic    = "force-dynamic";
export const maxDuration = 20;

export async function GET() {
  const start = Date.now();
  const prov  = aiProviderStatus();

  // Live AI ping
  let aiOk = false;
  let aiMs = 0;
  try {
    const t0  = Date.now();
    const res = await aiChat("You are a health check.", "Reply OK", { maxTokens: 5 });
    aiMs = Date.now() - t0;
    aiOk = res.provider !== "static";
  } catch { aiOk = false; }

  const healthy = aiOk;

  return NextResponse.json({
    status:    healthy ? "healthy" : "degraded",
    ok:        healthy,
    version:   "7.2.0",
    timestamp: new Date().toISOString(),
    checks: {
      api:         { status: "pass" },
      ai_provider: { status: aiOk ? "pass" : "fail", provider: prov.active_provider, latency_ms: aiMs },
      groq:        { status: prov.groq ? "pass" : "fail" },
      openai:      { status: prov.openai ? "pass" : "fail" },
    },
    latency_ms: Date.now() - start,
  }, { status: healthy ? 200 : 503 });
}
