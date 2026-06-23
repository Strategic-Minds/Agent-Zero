/**
 * ARIA — Primary AI Interface
 * Direct fetch, no lib/ai dependency
 */
import { getSupabaseAdmin } from "@/lib/supabase"

export interface ARIARequest {
  message: string
  conversation_id?: string
  company_id?: string
  context?: string
}

export interface ARIAResponse {
  reply: string
  conversation_id: string
  provider: string
}

const ARIA_SYSTEM = `You are ARIA, the AI assistant for Xtreme Polishing Systems (XPS) — a commercial epoxy flooring and concrete polishing company in Arizona.

Your roles:
1. Answer questions about XPS services (epoxy flooring, concrete polishing, decorative concrete)
2. Help qualify sales leads and recommend next actions
3. Provide owner Jeremy Bensen with business intelligence
4. Assist with CRM data and lead pipeline management

Be professional, concise, and action-oriented. Always move toward booking a site assessment.`

async function callAI(system: string, userMsg: string): Promise<string> {
  // Try Vercel Gateway first
  const token = process.env.VERCEL_OIDC_TOKEN
  if (token) {
    try {
      const res = await fetch("https://ai.vercel.app/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: system }, { role: "user", content: userMsg }],
          max_tokens: 500,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(12000),
      })
      if (res.ok) {
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
        return data.choices?.[0]?.message?.content || "No response"
      }
    } catch { /* fallthrough to groq */ }
  }

  // Groq fallback
  const groqKey = process.env.GROQ_API_KEY
  if (groqKey) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: "llama-3.1-70b-versatile",
          messages: [{ role: "system", content: system }, { role: "user", content: userMsg }],
          max_tokens: 500,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(12000),
      })
      if (res.ok) {
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
        return data.choices?.[0]?.message?.content || "No response"
      }
    } catch { /* fallthrough to static */ }
  }

  // Static fallback
  return "Hi, thank you for contacting XPS. One of our team members will get back to you shortly with a quote for your flooring project."
}

export async function runARIA(req: ARIARequest): Promise<ARIAResponse> {
  const db = getSupabaseAdmin()
  let context = req.context || ""

  if (req.company_id) {
    try {
      const { data } = await db.from("companies" as any)
        .select("company_name,city,lead_score,priority_tier,ai_profile_summary")
        .eq("id", req.company_id)
        .single()
      if (data) {
        const co = data as { company_name: string; city?: string; lead_score?: number; priority_tier?: string; ai_profile_summary?: string }
        context = `Lead: ${co.company_name} in ${co.city || "AZ"}, score ${co.lead_score}/100. ${co.ai_profile_summary || ""}`
      }
    } catch { /* non-fatal */ }
  }

  const system = context ? `${ARIA_SYSTEM}\n\nContext: ${context}` : ARIA_SYSTEM
  const reply = await callAI(system, req.message)

  try {
    await db.from("call_logs" as any).insert({
      company_id: req.company_id,
      company_name: "ARIA Session",
      call_date: new Date().toISOString(),
      call_outcome: "aria_chat",
      call_notes: `Q: ${req.message.slice(0, 100)}`,
      ai_call_summary: `Reply: ${reply.slice(0, 200)}`,
    })
  } catch { /* non-fatal */ }

  return {
    reply,
    conversation_id: req.conversation_id || `aria_${Date.now()}`,
    provider: process.env.VERCEL_OIDC_TOKEN ? "vercel_gateway" : process.env.GROQ_API_KEY ? "groq" : "static",
  }
}

export async function ariaWhatsAppReply(message: string, company_name: string, context: string): Promise<string> {
  const system = `You are the autonomous sales assistant for Xtreme Polishing Systems (XPS).
Replying to WhatsApp from: ${company_name}
Context: ${context}
Keep reply under 100 words. Goal: qualify lead and book free site assessment.`
  return callAI(system, message)
}
