import { NextRequest, NextResponse } from "next/server";
export const dynamic    = "force-dynamic";
export const maxDuration = 55;

const BASE44_API_KEY  = process.env.BASE44_API_KEY   || "";
const BASE44_AGENT_ID = process.env.BASE44_AGENT_ID  || "69db047707a15d69135e3de9";
const BASE44_CONV_ID  = process.env.BASE44_CONV_ID   || "69db04786e1e12f6317e2274";
const BASE          = "https://app.base44.com/api/agents";

async function sendMessage(message: string, convId: string): Promise<string> {
  const url  = BASE + "/" + BASE44_AGENT_ID + "/conversations/" + convId + "/messages";
  const resp = await fetch(url, {
    method: "POST",
    headers: { "api_key": BASE44_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "user", content: message }),
  });
  if (!resp.ok) {
    const e = await resp.text().catch(() => "");
    throw new Error("Base44 " + resp.status + ": " + e.slice(0,200));
  }
  const d = await resp.json() as { content?: string; message?: string; response?: string };
  return d.content || d.message || d.response || JSON.stringify(d).slice(0,300);
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/superagent",
    agent_id: BASE44_AGENT_ID,
    conv_id:  BASE44_CONV_ID,
    connected: BASE44_API_KEY.length > 10,
    status: "ready",
  });
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  if (!BASE44_API_KEY || BASE44_API_KEY.length < 10) {
    return NextResponse.json({ ok: false, error: "BASE44_API_KEY not configured" }, { status: 503 });
  }
  const body = await req.json().catch(() => ({})) as {
    message?: string; conversation_id?: string; context?: string;
  };
  const userMessage = body.message || "";
  if (!userMessage.trim()) {
    return NextResponse.json({ ok: false, error: "message is required" }, { status: 400 });
  }
  try {
    const convId   = body.conversation_id || BASE44_CONV_ID;
    const fullMsg  = body.context ? "[Context: " + body.context + "] " + userMessage : userMessage;
    const response = await sendMessage(fullMsg, convId);
    return NextResponse.json({ ok: true, response, conversation_id: convId, latency_ms: Date.now()-start });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0,300), latency_ms: Date.now()-start }, { status: 500 });
  }
}
