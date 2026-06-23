/**
 * VERCEL AI GATEWAY — Central AI client
 * Priority: Vercel AI Gateway (OIDC) > Groq > OpenAI > static
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface AIResponse {
  content: string
  model: string
  provider: "vercel_gateway" | "groq" | "openai" | "static"
}

async function tryGateway(msgs: ChatMessage[], model: string, maxTokens: number): Promise<string | null> {
  const token = process.env.VERCEL_OIDC_TOKEN
  if (!token) return null
  try {
    const r = await fetch("https://ai.vercel.app/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ model, messages: msgs, max_tokens: maxTokens, temperature: 0.7 }),
      signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) return null
    const d = await r.json() as { choices?: Array<{ message?: { content?: string } }> }
    return d.choices?.[0]?.message?.content ?? null
  } catch { return null }
}

async function tryGroq(msgs: ChatMessage[], maxTokens: number): Promise<string | null> {
  const key = process.env.GROQ_API_KEY
  if (!key) return null
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
      body: JSON.stringify({ model: "llama-3.1-70b-versatile", messages: msgs, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(12000),
    })
    if (!r.ok) return null
    const d = await r.json() as { choices?: Array<{ message?: { content?: string } }> }
    return d.choices?.[0]?.message?.content ?? null
  } catch { return null }
}

async function tryOpenAI(msgs: ChatMessage[], model: string, maxTokens: number): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
      body: JSON.stringify({ model, messages: msgs, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) return null
    const d = await r.json() as { choices?: Array<{ message?: { content?: string } }> }
    return d.choices?.[0]?.message?.content ?? null
  } catch { return null }
}

export async function ai(
  messages: ChatMessage[],
  options: { model?: string; maxTokens?: number } = {}
): Promise<AIResponse> {
  const model = options.model ?? "gpt-4o-mini"
  const maxTokens = options.maxTokens ?? 500
  const gw = await tryGateway(messages, model, maxTokens)
  if (gw) return { content: gw, model, provider: "vercel_gateway" }
  const groq = await tryGroq(messages, maxTokens)
  if (groq) return { content: groq, model: "llama-3.1-70b", provider: "groq" }
  const oai = await tryOpenAI(messages, model, maxTokens)
  if (oai) return { content: oai, model, provider: "openai" }
  return { content: "AI unavailable — try again shortly.", model: "static", provider: "static" }
}

export async function aiChat(
  system: string,
  user: string,
  options?: { model?: string; maxTokens?: number }
): Promise<AIResponse> {
  return ai([{ role: "system", content: system }, { role: "user", content: user }], options)
}

export async function aiText(system: string, user: string): Promise<string> {
  const r = await aiChat(system, user)
  return r.content
}

export async function aiJSON<T = Record<string, unknown>>(
  system: string,
  user: string,
  fallback: T
): Promise<T> {
  const r = await ai(
    [
      { role: "system", content: system + "

Return ONLY valid JSON. No markdown." },
      { role: "user", content: user },
    ],
    { maxTokens: 600 }
  )
  try { return JSON.parse(r.content) as T } catch { return fallback }
}

export function aiProviderStatus() {
  const gw = !!process.env.VERCEL_OIDC_TOKEN
  const groq = !!process.env.GROQ_API_KEY
  const oai = !!process.env.OPENAI_API_KEY
  return {
    vercel_gateway: gw,
    groq,
    openai: oai,
    active_provider: gw ? "vercel_gateway" : groq ? "groq" : oai ? "openai" : "static",
  }
}

export function getActiveProvider(): string {
  return aiProviderStatus().active_provider
}
