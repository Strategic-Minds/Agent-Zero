/**
 * ARIA API v6 — /api/aria — direct aiChat with debug trace
 */
import { NextRequest, NextResponse } from "next/server";
import { aiChat, aiProviderStatus } from "@/lib/ai";

export const dynamic  = "force-dynamic";
export const runtime  = "nodejs";
export const maxDuration = 45;

const SYSTEM = "You are ARIA, the XPS AI assistant. Be concise and professional.";

export async function GET() {
  const s = aiProviderStatus();
  return NextResponse.json({ agent:"ARIA v6", status:"active",
    active_provider: s.active_provider, groq_model: s.groq_model });
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const provStatus = aiProviderStatus();
  
  let bodyErr = "";
  let body: { message?:string; conversation_id?:string; stream?:boolean; channel?:string } = {};
  try {
    body = await req.json();
  } catch(e) {
    bodyErr = String(e);
  }
  
  const message = (body.message || "Hello").slice(0, 2000);
  
  let aiResult: Awaited<ReturnType<typeof aiChat>> | null = null;
  let aiErr = "";
  
  try {
    aiResult = await aiChat(SYSTEM, message, { maxTokens: 400 });
  } catch(e) {
    aiErr = String(e);
    aiResult = { content: "AI call threw: " + aiErr, model: "error", provider: "static" };
  }

  const elapsed = Date.now() - t0;

  return NextResponse.json({
    ok: !aiErr,
    response:        aiResult!.content,
    reply:           aiResult!.content,
    content:         aiResult!.content,
    conversation_id: body.conversation_id || "aria_" + t0,
    provider:        aiResult!.provider,
    model:           aiResult!.model,
    latency_ms:      elapsed,
    latencyMs:       elapsed,
    // debug fields
    _debug: {
      prov_status_at_startup: provStatus,
      body_err: bodyErr || null,
      ai_err:   aiErr   || null,
      groq_key_length: (process.env.GROQ_API_KEY || "").length,
      oai_key_length:  (process.env.OPENAI_API_KEY || "").length,
      gw_key_length:   (process.env.AI_GATEWAY_API_KEY || "").length,
    },
  });
}
