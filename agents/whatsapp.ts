/**
 * WHATSAPP PARALLEL ORCHESTRATION — Agent Zero Enterprise
 * Multi-session broadcast, 1:1, inbound routing, owner notify
 */
import { getSupabaseAdmin } from "@/lib/supabase"

export interface WhatsAppMessage {
  to: string
  message: string
  type?: "text" | "template"
}

export interface BroadcastResult {
  total: number
  sent: number
  failed: number
  results: Array<{ to: string; status: "sent" | "failed"; messageId?: string; error?: string }>
}

async function sendSingle(msg: WhatsAppMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const token = process.env.WHATSAPP_BUSINESS_TOKEN || process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_ID
  if (!token || !phoneId) return { success: false, error: "WhatsApp not configured" }

  const body = {
    messaging_product: "whatsapp",
    to: msg.to.replace(/\D/g, ""),
    type: "text",
    text: { body: msg.message },
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json() as { messages?: Array<{ id: string }>; error?: { message: string } }
    if (data.messages?.[0]?.id) return { success: true, messageId: data.messages[0].id }
    return { success: false, error: data.error?.message || `HTTP ${res.status}` }
  } catch (e) {
    return { success: false, error: String(e).slice(0, 100) }
  }
}

export async function broadcastParallel(messages: WhatsAppMessage[]): Promise<BroadcastResult> {
  const batchSize = 5
  const allResults: BroadcastResult["results"] = []

  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize)
    const settled = await Promise.allSettled(batch.map(async (msg) => {
      const r = await sendSingle(msg)
      return { to: msg.to, status: r.success ? "sent" as const : "failed" as const, messageId: r.messageId, error: r.error }
    }))
    for (const s of settled) {
      allResults.push(s.status === "fulfilled" ? s.value : { to: "unknown", status: "failed", error: String((s as PromiseRejectedResult).reason) })
    }
    if (i + batchSize < messages.length) await new Promise(r => setTimeout(r, 1000))
  }

  const sent = allResults.filter(r => r.status === "sent").length

  try {
    const db = getSupabaseAdmin()
    await db.from("whatsapp_broadcasts").insert({
      total: messages.length, sent, failed: messages.length - sent,
      created_at: new Date().toISOString(),
    })
  } catch { /* non-blocking */ }

  return { total: messages.length, sent, failed: messages.length - sent, results: allResults }
}

export async function notifyOwner(message: string): Promise<boolean> {
  const ownerPhone = process.env.OWNER_WHATSAPP
  if (!ownerPhone) return false
  const r = await sendSingle({ to: ownerPhone, message })
  return r.success
}

export async function sendReport(report: string, recipient?: string): Promise<boolean> {
  const to = recipient || process.env.OWNER_WHATSAPP || ""
  if (!to) return false
  const chunks: string[] = []
  for (let i = 0; i < report.length; i += 4000) { chunks.push(report.slice(i, i + 4000)) }
  if (!chunks.length) chunks.push(report)
  for (const chunk of chunks) {
    await sendSingle({ to, message: chunk })
    if (chunks.length > 1) await new Promise(r => setTimeout(r, 500))
  }
  return true
}

export async function processInboundMessage(from: string, text: string, messageId: string): Promise<void> {
  const db = getSupabaseAdmin()

  try {
    await db.from("whatsapp_messages").upsert({
      message_id: messageId,
      from_number: from,
      message: text,
      direction: "inbound",
      created_at: new Date().toISOString(),
    }, { onConflict: "message_id" })
  } catch { /* non-blocking */ }

  const BASE = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"
  try {
    const res = await fetch(`${BASE}/api/aria`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, channel: "whatsapp", session_id: from }),
    })
    const data = await res.json() as { response?: string }
    if (data.response) await sendSingle({ to: from, message: data.response })
  } catch { /* non-blocking */ }
}
