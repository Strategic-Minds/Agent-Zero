/**
 * ARIA — Primary AI Interface for Agent Zero
 * Uses Vercel AI Gateway — no OpenAI key needed
 */
import { aiChat, aiProviderStatus } from "@/lib/ai"
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
  tokens?: number
}

const ARIA_SYSTEM = `You are ARIA, the AI assistant for Xtreme Polishing Systems (XPS) — a commercial epoxy flooring and concrete polishing company based in Arizona.

Your roles:
1. Answer questions about XPS services (epoxy flooring, concrete polishing, decorative concrete)
2. Help qualify sales leads and recommend next actions
3. Provide owner Jeremy Bensen with business intelligence and system updates
4. Assist with CRM data and lead pipeline management

Be professional, concise, and action-oriented. Always move toward booking a site assessment or closing a deal.`

export async function runARIA(req: ARIARequest): Promise<ARIAResponse> {
  const db = getSupabaseAdmin()
  const provider = aiProviderStatus()
  let context = req.context || ""

  // Load company context if provided
  if (req.company_id) {
    try {
      const { data } = await db.from("companies" as any)
        .select("company_name,city,lead_score,priority_tier,ai_profile_summary")
        .eq("id", req.company_id)
        .single()
      if (data) {
        const co = data as { company_name: string; city?: string; lead_score?: number; priority_tier?: string; ai_profile_summary?: string }
        context += `

Lead context: ${co.company_name} in ${co.city || "AZ"}, score ${co.lead_score}/100 (${co.priority_tier}). ${co.ai_profile_summary || ""}`
      }
    } catch { /* non-fatal */ }
  }

  const system = context ? `${ARIA_SYSTEM}

Context: ${context}` : ARIA_SYSTEM
  const res = await aiChat(system, req.message, { model: "gpt-4o-mini", maxTokens: 600 })

  // Log to DB
  try {
    await db.from("call_logs" as any).insert({
      company_id: req.company_id,
      company_name: "ARIA Session",
      call_date: new Date().toISOString(),
      call_outcome: "aria_chat",
      call_notes: `Q: ${req.message.slice(0, 200)} | A: ${res.content.slice(0, 200)}`,
      ai_call_summary: `Provider: ${res.provider}`,
    })
  } catch { /* non-fatal */ }

  return {
    reply: res.content,
    conversation_id: req.conversation_id || `aria_${Date.now()}`,
    provider: res.provider,
  }
}

// WhatsApp auto-reply using ARIA
export async function ariaWhatsAppReply(message: string, company_name: string, context: string): Promise<string> {
  const system = `You are the autonomous sales assistant for Xtreme Polishing Systems (XPS).
Replying to WhatsApp from: ${company_name}
Context: ${context}
Keep reply under 100 words. Goal: qualify lead and book free site assessment.`

  const res = await aiChat(system, message, { maxTokens: 150 })
  return res.content
}
