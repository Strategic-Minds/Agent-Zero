/**
 * /api/superagent
 * Bridge to Base44 Superagent (XPS Agent Zero)
 * Sends messages and receives AI responses via the Base44 Agent API
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic    = "force-dynamic";
export const maxDuration = 55;

const BASE44_API_KEY = process.env.BASE44_API_KEY  || "";
const BASE44_AGENT_ID = process.env.BASE44_AGENT_ID || "69db047707a15d69135e3de9";
const BASE44_BASE     = "https://app.base44.com/api/agents";

async function getOrCreateConversation(): Promise<string> {
  const r = await fetch(BASE44_BASE + "/" + BASE44_AGENT_ID + "/conversations/default", {
    method: "POST",
    headers: { "api_key": BASE44_API_KEY, "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error("Conversation init failed: " + r.status);
  const d = await r.json() as { id?: string; conversation_id?: string };
  return d.id || d.conversation_id || "default";
}

async function sendMessage(conversationId: string, message: string): Promise<string> {
  const r = await fetch(
    BASE44_BASE + "/" + BASE44_AGENT_ID + "/conversations/" + conversationId + "/messages",
    {
      method: "POST",
      headers: { "api_key": BASE44_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    }
  );
  if (!r.ok) {
    const e = await r.text().catch(() => "");
    throw new Error("Message failed: " + r.status + " " + e.slice(0,200));
  }
  const d = await r.json() as { content?: string; message?: string; response?: string; text?: string };
  return d.content || d.message || d.response || d.text || JSON.stringify(d);
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/superagent",
    agent_id: BASE44_AGENT_ID,
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
    message?: string;
    conversation_id?: string;
    context?: string;
  };

  const userMessage = body.message || "";
  if (!userMessage.trim()) {
    return NextResponse.json({ ok: false, error: "message is required" }, { status: 400 });
  }

  try {
    const convId   = body.conversation_id || await getOrCreateConversation();
    const fullMsg  = body.context
      ? "[Context: " + body.context + "]

" + userMessage
      : userMessage;
    const response = await sendMessage(convId, fullMsg);

    return NextResponse.json({
      ok: true,
      response,
      conversation_id: convId,
      agent_id: BASE44_AGENT_ID,
      latency_ms: Date.now() - start,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0,300), latency_ms: Date.now()-start }, { status: 500 });
  }
}
