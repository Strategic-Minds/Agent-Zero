/**
 * /api/openai-setup - AI Provider Status
 * Shows which AI provider is currently active
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasGateway = !!process.env.VERCEL_OIDC_TOKEN;
  const hasGroq = !!process.env.GROQ_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  const active = hasGateway ? "vercel_gateway"
    : hasGroq ? "groq"
    : hasOpenAI ? "openai"
    : "static";

  return NextResponse.json({
    ok: true,
    active_provider: active,
    providers: {
      vercel_gateway: { enabled: hasGateway, note: "Auto-injected VERCEL_OIDC_TOKEN" },
      groq:           { enabled: hasGroq,    note: "GROQ_API_KEY env var" },
      openai:         { enabled: hasOpenAI,  note: "OPENAI_API_KEY env var" },
    },
    waterfall: ["vercel_gateway", "groq", "openai", "static"],
    message: active === "vercel_gateway"
      ? "Using Vercel AI Gateway - no OpenAI key needed"
      : active === "groq"
      ? "Using Groq (free tier) - fast and free"
      : active === "openai"
      ? "Using OpenAI directly"
      : "No AI provider configured - using static responses",
  });
}

export async function POST(req: Request) {
  return GET();
}
