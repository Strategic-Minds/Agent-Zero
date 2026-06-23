/**
 * /api/whatsapp-outreach
 * Sends XPS lead briefings to the owner via Base44 WhatsApp channel
 * Uses the Base44 Superagent API to push WhatsApp messages
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

// Send message to owner via Base44 Superagent API (WhatsApp)
async function sendToOwnerWhatsApp(message: string): Promise<{ ok: boolean; error?: string }> {
  const agentId      = process.env.BASE44_AGENT_ID      || "69db047707a15d69135e3de9";
  const apiKey       = process.env.BASE44_API_KEY        || "";
  const convId       = process.env.BASE44_CONVERSATION_ID || "";

  if (!apiKey) {
    return { ok: false, error: "BASE44_API_KEY not configured" };
  }

  try {
    const resp = await fetch(`https://api.base44.com/v1/agents/${agentId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        conversation_id: convId || undefined,
        channel: "whatsapp",
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      return { ok: false, error: `API ${resp.status}: ${err.slice(0,100)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e).slice(0,150) };
  }
}

// Build a clean WhatsApp-formatted lead briefing
async function buildLeadBriefing(leads: Lead[]): Promise<string> {
  const top = leads.slice(0, 5);
  const date = new Date().toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });

  let msg = `*XPS Lead Brief — ${date}*
`;
  msg += `${top.length} hot leads ready for outreach

`;

  for (let i = 0; i < top.length; i++) {
    const l = top[i];
    const tier = l.priority_tier || "B";
    const score = l.score || 75;
    msg += `*${i+1}. ${l.company}*
`;
    msg += `📍 ${l.city || "Arizona"} | Tier ${tier} | Score ${score}
`;
    if (l.phone) msg += `📞 ${l.phone}
`;
    if (l.pitch_opener) msg += `_"${l.pitch_opener.slice(0,80)}"_
`;
    msg += "
";
  }

  msg += `Reply *CALL* to get full details on any lead.`;
  return msg;
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/whatsapp-outreach",
    description: "WhatsApp lead briefing system — sends top leads to owner via Base44",
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

  // Test mode — send a simple ping
  if (mode === "test") {
    const result = await sendToOwnerWhatsApp(
      "*XPS Agent Zero* ✅

WhatsApp outreach system is online and ready.

Lead discovery + scoring + briefing pipeline active."
    );
    return NextResponse.json({
      ok: result.ok, mode: "test",
      error: result.error,
      latency_ms: Date.now() - start,
    });
  }

  // Custom message mode
  if (mode === "custom" && body.message) {
    const result = await sendToOwnerWhatsApp(body.message);
    return NextResponse.json({ ok: result.ok, mode: "custom", error: result.error, latency_ms: Date.now() - start });
  }

  // Brief mode — format and send lead briefing
  const leads = body.leads || [];
  if (leads.length === 0) {
    return NextResponse.json({ ok: false, error: "No leads provided. POST { leads: [...], mode: 'brief' }" }, { status: 400 });
  }

  const message = await buildLeadBriefing(leads);
  const result  = await sendToOwnerWhatsApp(message);

  return NextResponse.json({
    ok: result.ok, mode: "brief",
    leads_sent: leads.length,
    preview: message.slice(0, 300),
    error: result.error,
    latency_ms: Date.now() - start,
  });
}
