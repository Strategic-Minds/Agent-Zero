/**
 * /api/ai-test — Live AI provider test (raw fetch)
 */
import { NextResponse } from "next/server";
import { aiChat, aiProviderStatus } from "@/lib/ai";

export const dynamic    = "force-dynamic";
export const maxDuration = 20;

export async function GET() {
  const status = aiProviderStatus();
  const start  = Date.now();

  const res = await aiChat(
    "You are a test assistant.",
    "Reply with exactly: PROVIDER_OK",
    { maxTokens: 10 }
  );

  return NextResponse.json({
    ok:          res.provider !== "static",
    result:      res.content.includes("PROVIDER_OK") ? "pass" : "partial",
    content:     res.content,
    provider:    status.active_provider,
    latency_ms:  Date.now() - start,
    providers:   status,
  });
}
