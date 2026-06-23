/**
 * GPT AUTONOMOUS BRIDGE — /api/bridge/gpt
 * Synced from AUTO_BUILDER canonical bridge architecture
 * Allows GPT MCP to dispatch work into Agent Zero via governed bridge
 */
import { NextRequest, NextResponse } from "next/server";
import { aiChat } from "@/lib/ai";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function auth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  return (
    token === process.env.BRIDGE_SECRET ||
    token === process.env.AUTO_BUILDER_GPT_BRIDGE_SECRET ||
    token === process.env.GPT_RUNTIME_BRIDGE_SECRET ||
    token === process.env.AUTO_BUILDER_BRIDGE_TOKEN
  );
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    bridge: "GPT Autonomous Bridge",
    version: "1.0.0",
    status: "active",
    system: "Agent-Zero <-> AUTO_BUILDER",
    capabilities: ["ai_chat", "lead_discovery", "audit", "orchestrate", "validate"],
    auth: "Bearer BRIDGE_SECRET | AUTO_BUILDER_GPT_BRIDGE_SECRET",
  });
}

export async function POST(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    action?: string;
    prompt?: string;
    context?: string;
    system?: string;
    agent?: string;
    payload?: Record<string, unknown>;
  };

  const { action = "chat", prompt = "", context = "", system } = body;
  const receiptId = `bridge_${Date.now()}`;
  const startedAt = new Date().toISOString();

  try {
    // Log the bridge invocation
    try {
      const db = getSupabaseAdmin();
      await db.from("agent_audit_log" as any).insert({
        event_type: "gpt_bridge_call",
        agent: body.agent || "gpt",
        action,
        status: "started",
        receipt_id: receiptId,
        created_at: startedAt,
      });
    } catch { /* non-fatal */ }

    let result: unknown;

    if (action === "chat" || action === "ask") {
      const sysPrompt = system || "You are Agent Zero, the XPS AI orchestrator. Be concise and action-oriented.";
      const res = await aiChat(sysPrompt, prompt, { maxTokens: 800 });
      result = { reply: res.content, provider: res.provider, model: res.model };
    } else if (action === "audit") {
      const r = await fetch(`${process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : ""}/api/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: "agent-zero" }),
      });
      result = await r.json();
    } else if (action === "validate") {
      const r = await fetch(`${process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : ""}/api/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      result = await r.json();
    } else if (action === "orchestrate") {
      const r = await fetch(`${process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : ""}/api/orchestrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body.payload || {}),
      });
      result = await r.json();
    } else if (action === "health") {
      const r = await fetch(`${process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : ""}/api/health`);
      result = await r.json();
    } else {
      result = { error: `Unknown action: ${action}`, supported: ["chat", "ask", "audit", "validate", "orchestrate", "health"] };
    }

    // Log completion
    try {
      const db = getSupabaseAdmin();
      await db.from("agent_audit_log" as any).update({
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("receipt_id", receiptId);
    } catch { /* non-fatal */ }

    return NextResponse.json({ ok: true, action, result, receipt_id: receiptId, latency_ms: Date.now() - new Date(startedAt).getTime() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err), receipt_id: receiptId }, { status: 500 });
  }
}
