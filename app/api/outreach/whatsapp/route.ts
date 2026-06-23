import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as {
    company_id?: string; message_template?: string; dry_run?: boolean
  }

  const db = getSupabaseAdmin()

  // Get hot leads ready for outreach
  const { data: leads } = await db.from("companies" as any)
    .select("id,company_name,phone,lead_score,ai_pitch_recommendation")
    .gte("lead_score", 70)
    .is("last_outreach_date", null)
    .limit(body.company_id ? 1 : 10)
    .eq(body.company_id ? "id" : "entity_status", body.company_id || "Active")

  if (!leads?.length) return NextResponse.json({ status: "no_leads", sent: 0 })

  const results = []
  for (const lead of leads) {
    if (!lead.phone) { results.push({ company: lead.company_name, status: "no_phone" }); continue }

    const msg = body.message_template ||
      `Hi ${lead.company_name} — I'm reaching out from Xtreme Polishing Systems (XPS). ` +
      `We specialize in commercial epoxy flooring and concrete polishing across Arizona. ` +
      `We'd love to offer a free site assessment. Interested?`

    if (!body.dry_run) {
      // Send via Twilio WhatsApp
      const twilio_sid = process.env.TWILIO_ACCOUNT_SID
      const twilio_auth = process.env.TWILIO_AUTH_TOKEN
      const from = process.env.TWILIO_FROM_NUMBER || "whatsapp:+14155238886"
      const to = `whatsapp:${lead.phone.replace(/\D/g,"").replace(/^([^+])/,"+1$1")}`

      if (twilio_sid && twilio_auth) {
        const form = new URLSearchParams({ From: from, To: to, Body: msg })
        const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilio_sid}/Messages.json`, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${Buffer.from(`${twilio_sid}:${twilio_auth}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        }).catch(() => null)

        const sent = r?.ok
        if (sent) {
          await db.from("companies" as any).update({ last_outreach_date: new Date().toISOString() }).eq("id", lead.id)
        }
        results.push({ company: lead.company_name, status: sent ? "sent" : "failed", to })
      } else {
        results.push({ company: lead.company_name, status: "twilio_not_configured", message: msg })
      }
    } else {
      results.push({ company: lead.company_name, status: "dry_run", message: msg, phone: lead.phone })
    }
  }

  return NextResponse.json({ sent: results.filter(r => r.status === "sent").length, total: results.length, results })
}
