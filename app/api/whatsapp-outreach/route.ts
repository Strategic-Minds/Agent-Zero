/**
 * /api/whatsapp-outreach
 * Sends XPS lead briefings to the owner via Base44 Superagent API
 */
import { NextRequest, NextResponse } from "next/server";
import { aiText } from "@/lib/ai";

export const dynamic    = "force-dynamic";
export const maxDuration = 30;

interface Lead {
  company: string;
  city?: string;
  phone?: string;
  score?: number;
  pitch_opener?: string;
  priority_tier?: string;
}

async function sendToOwnerWhatsApp(message: string): Promise<{ ok: boolean; error?: string }> {
  const agentId = process.env.BASE44_AGENT_ID  || "69db047707a15d69135e3de9";
  const apiKey  = process.env.BASE44_API_KEY   || "";
  const convId  = process.env.BASE44_CONVERSATION_ID || "";

  if (!apiKey) {
    return { ok: false, error: "BASE44_API_KEY not configured" };
  }

  try {
    const resp = await fetch("https://api.base44.com/v1/agents/" + agentId + "/messages", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        conversation_id: convId || undefined,
        channel: "whatsapp",
      }),
    });

    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      return { ok: false, error: "API " + resp.status + ": " + err.slice(0,100) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e).slice(0,150) };
  }
}

function buildLeadBriefing(leads: Lead[]): string {
  const top  = leads.slice(0, 5);
  const date = new Date().toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });

  const lines: string[] = [
    "*XPS Lead Brief - " + date + "*",
    top.length + " hot leads ready for outreach",
    "",
  ];

  for (let i = 0; i < top.length; i++) {
    const l = top[i];
    lines.push("*" + (i+1) + ". " + l.company + "*");
    lines.push("City: " + (l.city || "Arizona") + " | Tier " + (l.priority_tier || "B") + " | Score " + (l.score || 75));
    if (l.phone) lines.push("Phone: " + l.phone);
    if (l.pitch_opener) lines.push('"' + l.pitch_opener.slice(0,80) + '"');
    lines.push("");
  }

  lines.push("Reply CALL to get full details on any lead.");
  return lines.join("\n");
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/whatsapp-outreach",
    description: "WhatsApp lead briefing system - sends top leads to owner via Base44",
    status: "ready",
  });
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  const body  = await req.json().catch(() => ({})) as {
    leads?: Lead[];
    message?: string;
    mode?: "brief" | "custom" | "test";
  };

  const mode = body.mode || "brief";

  if (mode === "test") {
    const msg    = "*XPS Agent Zero* - WhatsApp outreach system is online. Lead discovery + scoring + briefing pipeline active.";
    const result = await sendToOwnerWhatsApp(msg);
    return NextResponse.json({ ok: result.ok, mode: "test", error: result.error, latency_ms: Date.now() - start });
  }

  if (mode === "custom" && body.message) {
    const result = await sendToOwnerWhatsApp(body.message);
    return NextResponse.json({ ok: result.ok, mode: "custom", error: result.error, latency_ms: Date.now() - start });
  }

  const leads = body.leads || [];
  if (leads.length === 0) {
    return NextResponse.json({ ok: false, error: "No leads provided. POST { leads: [...], mode: brief }" }, { status: 400 });
  }

  const message = buildLeadBriefing(leads);
  const result  = await sendToOwnerWhatsApp(message);

  return NextResponse.json({
    ok: result.ok,
    mode: "brief",
    leads_sent: leads.length,
    preview: message.slice(0, 300),
    error: result.error,
    latency_ms: Date.now() - start,
  });
}
