/**
 * /api/ai-test - Live AI provider test
 */
import { NextResponse } from "next/server";
import { aiChat, aiProviderStatus } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const status = aiProviderStatus();
  const start = Date.now();
  let result = "not_tested";
  let error = "";

  try {
    const res = await aiChat(
      "You are a test assistant.",
      "Reply with exactly: PROVIDER_OK",
      { maxTokens: 20 }
    );
    result = res.content.includes("PROVIDER_OK") ? "pass" : "partial";
  } catch (e) {
    error = String(e);
    result = "fail";
  }

  return NextResponse.json({
    ok: result !== "fail",
    result,
    provider: status.active_provider,
    latency_ms: Date.now() - start,
    providers: status,
    error: error || undefined,
  });
}
