/**
 * /api/outreach — WhatsApp + SMS outreach via Twilio
 * Raw fetch to Twilio REST API. No SDK.
 */
import { NextRequest, NextResponse } from "next/server";
import { aiText } from "@/lib/ai";

export const dynamic    = "force-dynamic";
export const maxDuration = 30;

async function sendTwilioMessage(to: string, body: string, whatsapp = false): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const sid   = process.env.TWILIO_ACCOUNT_SID || "";
  const token = process.env.TWILIO_AUTH_TOKEN  || "";
  const from  = process.env.TWILIO_FROM_NUMBER || "+15005550006";

  if (!sid || !token || sid.length < 10) {
    return { ok: false, error: "Twilio not configured — add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER to env" };
  }

  const fromNum = whatsapp ? `whatsapp:${from}` : from;
  const toNum   = whatsapp ? `whatsapp:${to}`   : to;

  const formData = new URLSearchParams({ From: fromNum, To: toNum, Body: body });

  try {
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(12000),
      }
    );
    const data = await resp.json() as { sid?: string; error_message?: string; status?: string };
    if (!resp.ok || data.error_message) {
      return { ok: false, error: data.error_message || `HTTP ${resp.status}` };
    }
    return { ok: true, sid: data.sid };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 200) };
  }
}

export async function GET() {
  const configured = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  return NextResponse.json({
    endpoint: "/api/outreach",
    status: configured ? "ready" : "needs_credentials",
    channels: ["sms","whatsapp"],
    note: configured ? "Twilio configured" : "Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER to env",
  });
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  const body  = await req.json().catch(() => ({})) as {
    to?: string;
    company?: string;
    channel?: "sms" | "whatsapp";
    message?: string;
    mode?: "draft" | "send";
  };

  const to      = body.to || "";
  const company = body.company || "the company";
  const channel = body.channel || "sms";
  const mode    = body.mode || "draft";

  // Generate message with AI
  const message = body.message || await aiText(
    "You are an XPS sales rep. Write a short SMS outreach message (under 120 chars) for a cold prospect. Include a CTA to get a free estimate. Do NOT use emojis.",
    `Target company: ${company}. We sell commercial epoxy and polished concrete in Arizona.`
  );

  if (mode === "draft") {
    return NextResponse.json({
      ok: true,
      mode: "draft",
      to, channel, company,
      message,
      note: "Draft only — set mode=send to transmit via Twilio",
      latency_ms: Date.now() - start,
    });
  }

  if (!to || to.length < 10) {
    return NextResponse.json({ ok: false, error: "Valid 'to' phone number required for send mode" }, { status: 400 });
  }

  const result = await sendTwilioMessage(to, message, channel === "whatsapp");

  return NextResponse.json({
    ok: result.ok,
    mode: "send",
    to, channel, company, message,
    twilio_sid: result.sid,
    error: result.error,
    latency_ms: Date.now() - start,
  });
}
