import { NextRequest, NextResponse } from "next/server";
export const dynamic    = "force-dynamic";
export const maxDuration = 30;

const BASE44_API_KEY  = process.env.BASE44_API_KEY  || "";
const BASE44_AGENT_ID = process.env.BASE44_AGENT_ID || "69db047707a15d69135e3de9";
const BASE44_CONV_ID  = process.env.BASE44_CONV_ID  || "69db04786e1e12f6317e2274";
const BASE44_BASE     = "https://app.base44.com/api/agents";

// Native Base44 WhatsApp bridge — no Twilio needed
// Messages go through the connected WhatsApp channel on the Superagent
async function sendViaBase44(message: string): Promise<{ok:boolean;method:string;detail?:string}> {
  const url  = BASE44_BASE + "/" + BASE44_AGENT_ID + "/conversations/" + BASE44_CONV_ID + "/messages";
  const resp = await fetch(url, {
    method: "POST",
    headers: { "api_key": BASE44_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ content: message, role: "user" }),
  });
  if (resp.ok) return { ok: true, method: "base44_superagent" };
  return { ok: false, method: "base44_superagent", detail: "HTTP " + resp.status };
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/whatsapp-outreach",
    method: "base44_native",
    status: BASE44_API_KEY.length > 10 ? "ready" : "missing_key",
    note: "Uses Base44 Superagent WhatsApp channel — no Twilio required",
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    message?: string;
    leads?: Array<{company_name?:string; phone?:string; lead_score?:number; city?:string}>;
    type?: string;
  };

  if (body.type === "daily_brief" && body.leads) {
    const top = body.leads.slice(0, 5);
    const lines = top.map((l, i) =>
      (i+1) + ". " + (l.company_name||"Unknown") + " — Score: " + (l.lead_score||"N/A") + " — " + (l.city||"AZ")
    );
    const msg = "XPS Daily Lead Brief\n" + new Date().toLocaleDateString() + "\n\nTop Leads:\n" + lines.join("\n") + "\n\nPowered by Agent Zero";
    const result = await sendViaBase44(msg);
    return NextResponse.json({ ok: result.ok, type: "daily_brief", sent: top.length, method: result.method });
  }

  const message = body.message || "XPS Agent Zero — test ping " + new Date().toISOString();
  const result  = await sendViaBase44(message);
  return NextResponse.json({ ok: result.ok, method: result.method, detail: result.detail });
}
