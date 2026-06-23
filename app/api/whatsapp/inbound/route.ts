/**
 * WHATSAPP AUTONOMOUS COMMUNICATION SYSTEM — Inbound Handler
 * Receives Twilio webhook, routes to ARIA, replies autonomously
 * Uses Vercel AI Gateway for replies
 */
import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const maxDuration = 60

async function generateARIAReply(message: string, company_name: string, context: string): Promise<string> {
  const gateway_token = process.env.VERCEL_AI_GATEWAY_TOKEN || process.env.OPENAI_API_KEY
  if (!gateway_token) return `Thanks for reaching out! Someone from the XPS team will be in touch shortly.`

  const url = process.env.VERCEL_AI_GATEWAY_TOKEN
    ? "https://api.vercel.ai/openai/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions"

  const system = `You are the autonomous sales assistant for Xtreme Polishing Systems (XPS), a commercial epoxy flooring and concrete polishing company in Arizona.
You are replying to a WhatsApp message from ${company_name}.
Context: ${context}
Keep replies SHORT (under 100 words), friendly, professional, action-oriented.
Goal: qualify the lead and book a free site assessment.`

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${gateway_token}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 150,
        temperature: 0.7,
        messages: [{ role: "system", content: system }, { role: "user", content: message }],
      }),
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content || "Thanks for reaching out! We will be in touch soon."
  } catch {
    return "Thanks for your message! A member of our XPS team will follow up shortly."
  }
}

async function sendWhatsAppReply(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const auth = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER || "whatsapp:+14155238886"
  if (!sid || !auth) return false
  const form = new URLSearchParams({ From: from, To: to, Body: body })
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${sid}:${auth}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
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
  const context = company
    ? `Lead score: ${company.lead_score}/100. Profile: ${company.ai_profile_summary || "No profile yet"}`
    : "New inbound contact — not yet in CRM"

  const reply = await generateARIAReply(body, company_name, context)
  const sent = await sendWhatsAppReply(from, reply)

  try {
    await db.from("call_logs" as any).insert({
      company_id: company?.id,
      company_name,
      contact_phone: phone,
      call_date: new Date().toISOString(),
      call_outcome: "whatsapp_inbound",
      call_notes: `Inbound: "${body.slice(0, 200)}" | Reply: "${reply.slice(0, 200)}"`,
      ai_call_summary: `Autonomous WhatsApp reply sent: ${sent ? "YES" : "NO"}`,
    })
  } catch {
    // non-fatal
  }

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { status: 200, headers: { "Content-Type": "text/xml" } }
  )
}

export async function GET() {
  return NextResponse.json({
    status: "WhatsApp Autonomous System — ACTIVE",
    webhook_url: "/api/whatsapp/inbound",
    twilio_configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    aria_connected: !!(process.env.VERCEL_AI_GATEWAY_TOKEN || process.env.OPENAI_API_KEY),
  })
}
