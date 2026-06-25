/**
 * /api/superagent — Base44 Superagent bridge
 * Correct API: POST /conversations to get conv id, then
 * POST /conversations/{id}/messages with { role: "user", content: "..." }
 * Response is array of messages; last assistant message is the reply.
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic    = "force-dynamic";
export const maxDuration = 55;

const BASE44_API_KEY  = process.env.BASE44_API_KEY   || "";
const BASE44_AGENT_ID = process.env.BASE44_AGENT_ID  || "69db047707a15d69135e3de9";
const CONV_ID_FIXED   = "69db04786e1e12f6317e2274";
const BASE           = "https://app.base44.com/api/agents/" + BASE44_AGENT_ID;

async function sendMessage(convId: string, content: string): Promise<string> {
  const resp = await fetch(BASE + "/conversations/" + convId + "/messages", {
    method: "POST",
    headers: { "api_key": BASE44_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "user", content }),
  });
  if (!resp.ok) {
    const e = await resp.text().catch(() => "");
    throw new Error("Base44 " + resp.status + ": " + e.slice(0, 200));
  }
  const data = await resp.json() as unknown;
  // Response is array of all messages — find last assistant message
  const msgs = Array.isArray(data) ? data : (data as Record<string,unknown[]>)?.messages || [];
  const assistants = (msgs as Array<{role:string;content:string}>).filter(m => m.role === "assistant");
  const last = assistants[assistants.length - 1];
  return last?.content || JSON.stringify(data).slice(0, 300);
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/superagent",
    agent_id: BASE44_AGENT_ID,
    conv_id:  CONV_ID_FIXED,
    connected: BASE44_API_KEY.length > 10,
    status: "ready",
  });
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  if (!BASE44_API_KEY || BASE44_API_KEY.length < 10) {
    return NextResponse.json({ ok: false, error: "BASE44_API_KEY not configured" }, { status: 503 });
  }
  const body = await req.json().catch(() => ({})) as { message?: string; context?: string };
  const userMessage = (body.message || "").trim();
  if (!userMessage) {
    return NextResponse.json({ ok: false, error: "message is required" }, { status: 400 });
  }
  try {
    const full = body.context ? "[Context: " + body.context + "] " + userMessage : userMessage;
    const response = await sendMessage(CONV_ID_FIXED, full);
    return NextResponse.json({
      ok: true,
      response,
      conversation_id: CONV_ID_FIXED,
      agent_id: BASE44_AGENT_ID,
      latency_ms: Date.now() - start,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 300), latency_ms: Date.now() - start }, { status: 500 });
  }
}
