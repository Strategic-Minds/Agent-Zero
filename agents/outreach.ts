/**
 * OUTREACH Agent v2 — Automated Follow-up + Lead Sequencing
 */
import { generateObject } from "ai"
import { createGroq } from "@ai-sdk/groq"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"
import { getSupabaseAdmin } from "../lib/supabase"
import { remember } from "../lib/memory"
import { logAction, checkPermission } from "../lib/governance"

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! })
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! })
let _useOpenAI = false
function getModel() { return _useOpenAI ? openai("gpt-4o-mini") : groq("llama-3.3-70b-versatile") }

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try { return await fn() }
    catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if ((msg.includes("rate limit") || msg.includes("429") || msg.includes("TPM") || msg.includes("TPD") || msg.includes("quota")) && i < 2) {
        _useOpenAI = true; await new Promise(r => setTimeout(r, 3000 * (i + 1))); continue
      }
      throw e
    }
  }
  throw new Error("Outreach: max retries")
}

export async function generateOutreachBatch(limit = 10): Promise<{ drafted: number; queued: number; errors: number; drafts: unknown[] }> {
  const perm = await checkPermission("outreach_draft", "outreach")
  await logAction({ agent_id: "outreach", action: "generate_batch", level: 1, status: perm.allowed ? "allowed" : "blocked" })

  const db = getSupabaseAdmin()
  const { data: leads } = await db.from("companies").select("*").in("priority_tier", ["S","A","B"]).is("status", null).limit(limit)
  if (!leads?.length) return { drafted: 0, queued: 0, errors: 0, drafts: [] }

  const drafts: unknown[] = []
  let drafted = 0, errors = 0

  for (const lead of leads) {
    try {
      const { object } = await withRetry(() => generateObject({
        model: getModel(),
        schema: z.object({
          subject: z.string(),
          body: z.string().max(500),
          channel: z.enum(["email","phone","sms"]),
          priority: z.enum(["high","medium","low"]),
        }),
        prompt: `Write a short, direct outreach for ${lead.company_name} (${lead.city}, ${lead.state}). 
We are XPS Intelligence — largest epoxy distributor in North America.
Their score: ${lead.lead_score||0}/100. Tier: ${lead.priority_tier||"B"}.
Notes: ${lead.ai_pitch_recommendation||lead.raw_notes||"epoxy/polished concrete contractor"}.
Write a genuine, non-spammy outreach. Max 100 words for email body.`,
      }))
      await db.from("outreach_log").insert({ company_id: lead.id, channel: object.channel, direction: "outbound", outcome: "drafted", notes: `${object.subject}\n\n${object.body}`, created_at: new Date().toISOString() })
      drafts.push({ company: lead.company_name, ...object })
      drafted++
    } catch { errors++ }
    await new Promise(r => setTimeout(r, 400))
  }

  await remember({ agent_id: "agent-zero", key: "last_outreach_batch", value: { drafted, errors, timestamp: new Date().toISOString() }, memory_type: "episodic", importance: 4 }).catch(() => {})
  return { drafted, queued: drafted, errors, drafts }
}

export async function getPendingApprovals(): Promise<unknown[]> {
  const db = getSupabaseAdmin()
  const { data } = await db.from("outreach_log").select("*,companies(company_name,phone,email)").eq("outcome", "drafted").order("created_at", { ascending: false }).limit(20)
  return data || []
}
