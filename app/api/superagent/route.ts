import { NextRequest, NextResponse } from "next/server";

export const dynamic    = "force-dynamic";
export const maxDuration = 55;

const BASE44_API_KEY  = process.env.BASE44_API_KEY  || "";
const AGENT_ID        = process.env.BASE44_AGENT_ID || "69db047707a15d69135e3de9";
const BASE            = "https://app.base44.com/api/agents";

// Persistent conversation ID — reuse across calls
const FIXED_CONV_ID   = "69db04786e1e12f6317e2274";

async function b44fetch(path: string, method = "GET", body?: object) {
  const opts: RequestInit = {
    method,
    headers: { "api_key": BASE44_API_KEY, "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(BASE + "/" + AGENT_ID + path, opts);
  const text = await r.text();
  if (!r.ok) throw new Error("B44 " + r.status + ": " + text.slice(0, 200));
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/superagent",
    agent_id: AGENT_ID,
    conv_id:  FIXED_CONV_ID,
    connected: BASE44_API_KEY.length > 8,
    status: "ready",
  });
}

export async function POST(req: NextRequest) {
  const start = Date.now();

  if (!BASE44_API_KEY || BASE44_API_KEY.length < 8) {
    return NextResponse.json({ ok: false, error: "BASE44_API_KEY not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({})) as {
    message?: string;
    conversation_id?: string;
    context?: string;
  };

  const userMessage = (body.message || "").trim();
  if (!userMessage) {
    return NextResponse.json({ ok: false, error: "message is required" }, { status: 400 });
  }

  const convId  = body.conversation_id || FIXED_CONV_ID;
  const fullMsg = body.context
    ? "[XPS Dashboard — " + body.context + "] " + userMessage
    : userMessage;

  try {
    // Send message — requires role:user + content
    const sent = await b44fetch(
      "/conversations/" + convId + "/messages",
      "POST",
      { content: fullMsg, role: "user" }
    ) as Array<{ role: string; content: string; id: string }> | { role?: string; content?: string };

    // Extract assistant reply — API returns full message list
    let reply = "";
    if (Array.isArray(sent)) {
      const asst = [...sent].reverse().find((m) => m.role === "assistant");
      reply = asst?.content || "";
    } else if (sent && typeof sent === "object" && "content" in sent) {
      reply = (sent as { content?: string }).content || "";
    }

    if (!reply) {
      // Fallback: fetch conversation and get last assistant message
      const conv = await b44fetch("/conversations") as Array<{ id: string; messages: Array<{role:string;content:string}> }>;
      if (Array.isArray(conv)) {
        const target = conv.find((c) => c.id === convId);
        if (target?.messages) {
          const asst = [...target.messages].reverse().find((m) => m.role === "assistant");
          reply = asst?.content || "Agent did not respond.";
        }
      }
    }

    return NextResponse.json({
      ok: true,
      response: reply || "No response returned.",
      conversation_id: convId,
      agent_id: AGENT_ID,
      latency_ms: Date.now() - start,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: String(e).slice(0, 300),
      latency_ms: Date.now() - start,
    }, { status: 500 });
  }
}
