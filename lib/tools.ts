/**
 * AGENT ZERO — TOOL REGISTRY v2.0 (ai@3.x compatible)
 * 20 tools for full Base44 parity + enterprise extensions
 * Uses ai@3.x tool definition format
 */
import { z } from "zod"
import { getSupabaseAdmin } from "./supabase"

// Tool type for ai@3.x
export interface AgentTool {
  description: string
  parameters: z.ZodObject<z.ZodRawShape>
  execute: (args: Record<string, unknown>) => Promise<unknown>
}

// ── DATABASE TOOLS ────────────────────────────────────────────────────────────
async function dbCreateFn(args: Record<string, unknown>) {
  const db = getSupabaseAdmin()
  const { data: row, error } = await db.from(args.table as string).insert(args.data as Record<string, unknown>).select().single()
  if (error) throw new Error(error.message)
  return { success: true, record: row }
}

async function dbReadFn(args: Record<string, unknown>) {
  const db = getSupabaseAdmin()
  let q = db.from(args.table as string).select("*").limit((args.limit as number) ?? 50)
  if (args.filters) for (const [k, v] of Object.entries(args.filters as Record<string, unknown>)) q = q.eq(k, v as string)
  if (args.orderBy) q = q.order(args.orderBy as string, { ascending: false })
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return { records: data, count: data?.length ?? 0 }
}

async function dbUpdateFn(args: Record<string, unknown>) {
  const db = getSupabaseAdmin()
  const { data: row, error } = await db.from(args.table as string).update(args.data as Record<string, unknown>).eq("id", args.id as string).select().single()
  if (error) throw new Error(error.message)
  return { success: true, record: row }
}

async function dbDeleteFn(args: Record<string, unknown>) {
  if (!args.confirmed) return { blocked: true, reason: "Deletion requires confirmed:true — Level 4 action needs explicit Jeremy approval" }
  const db = getSupabaseAdmin()
  const { error } = await db.from(args.table as string).delete().eq("id", args.id as string)
  if (error) throw new Error(error.message)
  return { success: true, deleted_id: args.id }
}

async function dbQueryFn(args: Record<string, unknown>) {
  const db = getSupabaseAdmin()
  let q = db.from(args.table as string).select("*").limit((args.limit as number) ?? 50)
  if (args.search && args.searchColumn) q = q.ilike(args.searchColumn as string, `%${args.search}%`)
  if (args.eq) for (const [k, v] of Object.entries(args.eq as Record<string, unknown>)) q = q.eq(k, v as string)
  if (args.orderBy) q = q.order(args.orderBy as string, { ascending: false })
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return { records: data, count: data?.length ?? 0 }
}

async function memoryWriteFn(args: Record<string, unknown>) {
  const db = getSupabaseAdmin()
  await db.from("agent_memory").upsert({ agent_id: "agent-zero", key: args.key, value: args.value, memory_type: "semantic", importance: (args.importance as number) ?? 5, updated_at: new Date().toISOString() }, { onConflict: "agent_id,key" })
  return { saved: true, key: args.key, value: args.value }
}

async function memoryReadFn(args: Record<string, unknown>) {
  const db = getSupabaseAdmin()
  const { data } = await db.from("agent_memory").select("value,importance,updated_at").eq("agent_id", "agent-zero").eq("key", args.key as string).single()
  return { key: args.key, value: data?.value ?? null, found: !!data }
}

async function memorySearchFn(args: Record<string, unknown>) {
  const db = getSupabaseAdmin()
  const { data } = await db.from("agent_memory").select("key,value,importance").eq("agent_id", "agent-zero").ilike("key", `%${args.query}%`).order("importance", { ascending: false }).limit((args.limit as number) ?? 10)
  return { memories: data || [], count: data?.length ?? 0 }
}

async function githubReadFileFn(args: Record<string, unknown>) {
  const token = process.env.GITHUB_TOKEN
  const r = (args.repo as string) || process.env.GITHUB_REPO || "Strategic-Minds/Agent-Zero"
  const res = await fetch(`https://api.github.com/repos/${r}/contents/${args.path}`, { headers: { Authorization: `token ${token}` } })
  if (!res.ok) return { error: `Not found: ${args.path}` }
  const data = await res.json() as { content: string; sha: string }
  const content = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString()
  return { path: args.path, content: content.slice(0, 8000), sha: data.sha }
}

async function githubWriteFileFn(args: Record<string, unknown>) {
  const token = process.env.GITHUB_TOKEN
  const r = (args.repo as string) || process.env.GITHUB_REPO || "Strategic-Minds/Agent-Zero"
  let sha = ""
  try {
    const existing = await fetch(`https://api.github.com/repos/${r}/contents/${args.path}`, { headers: { Authorization: `token ${token}` } })
    if (existing.ok) { const d = await existing.json() as { sha: string }; sha = d.sha }
  } catch { /* new file */ }
  const payload: Record<string, string> = { message: args.message as string, content: Buffer.from(args.content as string).toString("base64") }
  if (sha) payload.sha = sha
  const res = await fetch(`https://api.github.com/repos/${r}/contents/${args.path}`, { method: "PUT", headers: { Authorization: `token ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) })
  const data = await res.json() as { content?: { sha: string } }
  return { success: res.ok, path: args.path, sha: data.content?.sha }
}

async function githubListFilesFn(args: Record<string, unknown>) {
  const token = process.env.GITHUB_TOKEN
  const r = (args.repo as string) || process.env.GITHUB_REPO || "Strategic-Minds/Agent-Zero"
  const res = await fetch(`https://api.github.com/repos/${r}/contents/${args.path || ""}`, { headers: { Authorization: `token ${token}` } })
  if (!res.ok) return { error: "Not found", files: [] }
  const data = await res.json() as Array<{ name: string; path: string; type: string; size: number }>
  const files = Array.isArray(data) ? data.map(f => ({ name: f.name, path: f.path, type: f.type, size: f.size })) : []
  return { files, count: files.length }
}

async function webFetchFn(args: Record<string, unknown>) {
  const res = await fetch(args.url as string, { headers: { "User-Agent": "Mozilla/5.0 AgentZero/2.0" }, signal: AbortSignal.timeout(15000) })
  const html = await res.text()
  const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 6000)
  return { url: args.url, status: res.status, content: text }
}

async function webSearchFn(args: Record<string, unknown>) {
  const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(args.query as string)}&format=json&no_redirect=1`, { signal: AbortSignal.timeout(10000) })
  const data = await res.json() as { AbstractText?: string; Heading?: string; AbstractURL?: string; RelatedTopics?: Array<{ Text?: string; FirstURL?: string }> }
  const results = [
    data.AbstractText ? { title: data.Heading || "", snippet: data.AbstractText, url: data.AbstractURL || "" } : null,
    ...(data.RelatedTopics || []).slice(0, 4).map(t => t.Text ? { title: "", snippet: t.Text, url: t.FirstURL || "" } : null),
  ].filter(Boolean)
  return { query: args.query, results, abstract: data.AbstractText || "" }
}

async function whatsappOwnerFn(args: Record<string, unknown>) {
  const to = process.env.OWNER_WHATSAPP
  const token = process.env.WHATSAPP_BUSINESS_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!to || !token || !phoneId) return { error: "WhatsApp not fully configured", missing: { to: !to, token: !token, phoneId: !phoneId } }
  const prefix = args.urgency === "critical" ? "🚨 " : args.urgency === "high" ? "⚠️ " : "📋 "
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/\D/g, ""), type: "text", text: { body: prefix + (args.message as string) } }),
  })
  return { sent: res.ok, status: res.status }
}

async function hubspotContactsFn(args: Record<string, unknown>) {
  const key = process.env.HUBSPOT_API_KEY
  if (!key) return { error: "HUBSPOT_API_KEY not set", contacts: [], note: "Add HUBSPOT_API_KEY to Vercel env vars" }
  const url = `https://api.hubapi.com/crm/v3/objects/contacts?limit=${(args.limit as number) ?? 10}&properties=firstname,lastname,email,phone,company`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } })
  const data = await res.json() as { results?: unknown[]; total?: number; message?: string }
  if (!res.ok) return { error: data.message, contacts: [] }
  return { contacts: data.results || [], count: data.total || 0 }
}

async function hubspotCreateContactFn(args: Record<string, unknown>) {
  const key = process.env.HUBSPOT_API_KEY
  if (!key) return { error: "HUBSPOT_API_KEY not set" }
  const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ properties: { firstname: args.firstname, lastname: args.lastname, email: args.email, phone: args.phone, company: args.company } }),
  })
  const data = await res.json() as { id?: string; message?: string }
  return { success: res.ok, id: data.id, error: data.message }
}

async function systemStatusFn(_args: Record<string, unknown>) {
  const db = getSupabaseAdmin()
  const [co, me, al] = await Promise.all([
    db.from("companies").select("*", { count: "exact", head: true }),
    db.from("agent_memory").select("*", { count: "exact", head: true }),
    db.from("agent_actions").select("*", { count: "exact", head: true }),
  ])
  return {
    status: "operational",
    version: "2.0.0",
    agents: ["ARIA v2", "APEX v2", "GHOST v1", "DISCOVERY v1", "OUTREACH v1", "INTELLIGENCE v1"],
    tools_available: 20,
    database: { companies: co.count ?? 0, memory_entries: me.count ?? 0, agent_actions: al.count ?? 0 },
    env: { groq: !!process.env.GROQ_API_KEY, openai: !!process.env.OPENAI_API_KEY, supabase: !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL), hubspot: !!process.env.HUBSPOT_API_KEY, whatsapp: !!process.env.WHATSAPP_BUSINESS_TOKEN, github_token: !!process.env.GITHUB_TOKEN, github_repo: !!process.env.GITHUB_REPO },
    timestamp: new Date().toISOString(),
  }
}

async function generateReportFn(args: Record<string, unknown>) {
  const db = getSupabaseAdmin()
  const [co, ou] = await Promise.all([
    db.from("companies").select("priority_tier,status,lead_score,company_name").order("lead_score", { ascending: false }).limit(20),
    db.from("outreach_log").select("channel,outcome,created_at").order("created_at", { ascending: false }).limit(10),
  ])
  const companies = co.data || []
  const outreach = ou.data || []
  const tierCounts = companies.reduce((a: Record<string, number>, c: { priority_tier?: string }) => { a[c.priority_tier || "U"] = (a[c.priority_tier || "U"] || 0) + 1; return a }, {})
  const topLeads = companies.slice(0, 5).map((c: { company_name?: string; priority_tier?: string; lead_score?: number }) => `${c.company_name} (T${c.priority_tier}, ${c.lead_score}pts)`).join("\n")
  const format = args.format as string || "text"
  if (format === "whatsapp") {
    return { report: `📊 *${String(args.type || "LEADS").toUpperCase()} REPORT*\n\nTotal Leads: ${companies.length}\nTier S: ${tierCounts["S"] || 0} | A: ${tierCounts["A"] || 0} | B: ${tierCounts["B"] || 0}\nOutreach: ${outreach.length}\n\n*Top Leads:*\n${topLeads || "None yet"}\n\n_${new Date().toISOString().slice(0, 16)} UTC_` }
  }
  return { type: args.type, total_companies: companies.length, tier_breakdown: tierCounts, recent_outreach: outreach.length, top_leads: companies.slice(0, 5) }
}

async function emailDraftFn(args: Record<string, unknown>) {
  return {
    draft: true, to: args.to, subject: args.subject,
    body: `Hi,\n\nI'm reaching out from Xtreme Polishing Systems regarding ${args.companyName}.\n\n${args.context || "We specialize in epoxy flooring, polished concrete, and decorative surfaces."}\n\nWould you have 15 minutes this week?\n\nBest,\nXPS Intelligence Team`,
    note: "Review this draft. To send, use email_send tool with confirmed:true.",
  }
}

// ── TOOL REGISTRY ─────────────────────────────────────────────────────────────
export const ALL_TOOLS: Record<string, AgentTool> = {
  db_create:              { description: "Create a record in a Supabase table", parameters: z.object({ table: z.string(), data: z.record(z.unknown()) }), execute: dbCreateFn },
  db_read:                { description: "Read records from a Supabase table with optional filters and ordering", parameters: z.object({ table: z.string(), filters: z.record(z.unknown()).optional(), limit: z.number().optional(), orderBy: z.string().optional() }), execute: dbReadFn },
  db_update:              { description: "Update a record in a Supabase table by ID", parameters: z.object({ table: z.string(), id: z.string(), data: z.record(z.unknown()) }), execute: dbUpdateFn },
  db_delete:              { description: "Delete a record (requires confirmed:true — Level 4 governance)", parameters: z.object({ table: z.string(), id: z.string(), confirmed: z.boolean() }), execute: dbDeleteFn },
  db_query:               { description: "Advanced query with search, filter, sort, pagination", parameters: z.object({ table: z.string(), search: z.string().optional(), searchColumn: z.string().optional(), eq: z.record(z.string()).optional(), limit: z.number().optional(), orderBy: z.string().optional() }), execute: dbQueryFn },
  memory_write:           { description: "Save information to persistent agent memory (survives across sessions)", parameters: z.object({ key: z.string(), value: z.unknown(), importance: z.number().min(1).max(10).optional() }), execute: memoryWriteFn },
  memory_read:            { description: "Read a specific memory entry by key", parameters: z.object({ key: z.string() }), execute: memoryReadFn },
  memory_search:          { description: "Search all memory entries by keyword", parameters: z.object({ query: z.string(), limit: z.number().optional() }), execute: memorySearchFn },
  github_read_file:       { description: "Read a file from the GitHub repository", parameters: z.object({ path: z.string(), repo: z.string().optional() }), execute: githubReadFileFn },
  github_write_file:      { description: "Write or update a file in the GitHub repository", parameters: z.object({ path: z.string(), content: z.string(), message: z.string(), repo: z.string().optional() }), execute: githubWriteFileFn },
  github_list_files:      { description: "List files in a directory of the GitHub repository", parameters: z.object({ path: z.string().optional() }), execute: githubListFilesFn },
  web_fetch:              { description: "Fetch and extract text content from any public URL", parameters: z.object({ url: z.string() }), execute: webFetchFn },
  web_search:             { description: "Search the web for current information on any topic", parameters: z.object({ query: z.string() }), execute: webSearchFn },
  whatsapp_send_owner:    { description: "Send a WhatsApp message to Jeremy (the owner)", parameters: z.object({ message: z.string(), urgency: z.enum(["low","medium","high","critical"]).optional() }), execute: whatsappOwnerFn },
  hubspot_get_contacts:   { description: "Get contacts from HubSpot CRM", parameters: z.object({ limit: z.number().optional(), search: z.string().optional() }), execute: hubspotContactsFn },
  hubspot_create_contact: { description: "Create a new contact in HubSpot CRM", parameters: z.object({ firstname: z.string().optional(), lastname: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), company: z.string().optional() }), execute: hubspotCreateContactFn },
  system_status:          { description: "Get complete Agent Zero system status: all agents, DB counts, env vars", parameters: z.object({}), execute: systemStatusFn },
  generate_report:        { description: "Generate a business intelligence report (leads, pipeline, outreach, weekly)", parameters: z.object({ type: z.enum(["leads","pipeline","outreach","weekly","summary"]), format: z.enum(["text","whatsapp","json"]).optional() }), execute: generateReportFn },
  email_draft:            { description: "Draft a professional outreach email (does NOT send — requires review)", parameters: z.object({ to: z.string(), subject: z.string(), companyName: z.string(), context: z.string().optional() }), execute: emailDraftFn },
  db_query_advanced:      { description: "Same as db_query — alias", parameters: z.object({ table: z.string(), search: z.string().optional(), searchColumn: z.string().optional(), eq: z.record(z.string()).optional(), limit: z.number().optional(), orderBy: z.string().optional() }), execute: dbQueryFn },
}

// Convert to ai@3.x format (experimental_tool in v3 or just use generateText with tools directly)
export type ToolName = keyof typeof ALL_TOOLS
