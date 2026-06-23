/**
 * WHATSAPP AUTONOMOUS COMMUNICATION SYSTEM
 * Uses Vercel AI Gateway via lib/ai — no OpenAI key needed
 */
import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { ariaWhatsAppReply } from "@/agents/aria"

export const dynamic = "force-dynamic"
export const maxDuration = 60

async function sendTwilioReply(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const auth = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER || "whatsapp:+14155238886"
  if (!sid || !auth) return false
  const form = new URLSearchParams({ From: from, To: to, Body: body })
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { "Authorization": `Basic ${Buffer.from(`${sid}:${auth}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  }).catch(() => null)
  return r?.ok || false
}

export async function POST(req: Request) {
  const db = getSupabaseAdmin()
  const text = await req.text()
  const params = Object.fromEntries(new URLSearchParams(text))

  const from = params.From || ""
  const body = params.Body || ""
  const profileName = params.ProfileName || "Unknown"
  const phone = from.replace("whatsapp:", "")

  if (!body || !from) return new Response("OK", { status: 200 })

  const { data: companies } = await db.from("companies" as any)
    .select("id,company_name,ai_profile_summary,lead_score")
    .ilike("phone", `%${phone.replace("+1", "").replace(/\D/g, "").slice(-10)}%`)
    .limit(1)

  const company = companies?.[0] as { id: string; company_name: string; ai_profile_summary?: string; lead_score?: number } | undefined
  const company_name = company?.company_name || profileName
  const context = company ? `Score: ${company.lead_score}/100. ${company.ai_profile_summary || ""}` : "New inbound — not in CRM"

  const reply = await ariaWhatsAppReply(body, company_name, context)
  const sent = await sendTwilioReply(from, reply)

  try {
    await db.from("call_logs" as any).insert({
      company_id: company?.id,
      company_name,
      contact_phone: phone,
      call_date: new Date().toISOString(),
      call_outcome: "whatsapp_inbound",
      call_notes: `Inbound: "${body.slice(0, 200)}" | Reply: "${reply.slice(0, 200)}"`,
      ai_call_summary: `WhatsApp reply sent: ${sent ? "YES" : "NO"}`,
    })
  } catch { /* non-fatal */ }

  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
    status: 200, headers: { "Content-Type": "text/xml" }
  })
}

export async function GET() {
  return NextResponse.json({
    status: "WhatsApp Autonomous System — ACTIVE",
    twilio_configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    ai_provider: process.env.VERCEL_OIDC_TOKEN ? "vercel_gateway" : process.env.GROQ_API_KEY ? "groq" : "static",
  })
}
