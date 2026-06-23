/**
 * VERCEL AI GATEWAY — Central AI client
 * Primary: Vercel AI Gateway (OIDC auto-auth, no key needed)
 * Fallback 1: Groq (free tier, fast)
 * Fallback 2: OpenAI direct
 * Fallback 3: Static response (never fails)
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

async function callVercelGateway(messages: ChatMessage[], model: string, maxTokens: number): Promise<string | null> {
  const token = process.env.VERCEL_OIDC_TOKEN
  if (!token) return null
  try {
    const res = await fetch("https://ai.vercel.app/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7 }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content || null
  } catch { return null }
}

async function callGroq(messages: ChatMessage[], maxTokens: number): Promise<string | null> {
  const key = process.env.GROQ_API_KEY
  if (!key) return null
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ model: "llama-3.1-70b-versatile", messages, max_tokens: maxTokens, temperature: 0.7 }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content || null
  } catch { return null }
}

async function callOpenAI(messages: ChatMessage[], model: string, maxTokens: number): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7 }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content || null
  } catch { return null }
}

export async function ai(
  messages: ChatMessage[],
  options: { model?: string; maxTokens?: number } = {}
): Promise<AIResponse> {
  const model = options.model ?? "gpt-4o-mini"
  const maxTokens = options.maxTokens ?? 500

  const gw = await callVercelGateway(messages, model, maxTokens)
  if (gw) return { content: gw, model, provider: "vercel_gateway" }

  const groq = await callGroq(messages, maxTokens)
  if (groq) return { content: groq, model: "llama-3.1-70b", provider: "groq" }

  const oai = await callOpenAI(messages, model, maxTokens)
  if (oai) return { content: oai, model, provider: "openai" }

  return { content: "AI response unavailable. Please try again shortly.", model: "static", provider: "static" }
}

export async function aiChat(
  system: string,
  user: string,
  options?: { model?: string; maxTokens?: number }
): Promise<AIResponse> {
  return ai(
    [{ role: "system", content: system }, { role: "user", content: user }],
    options
  )
}

export async function aiJSON<T = Record<string, unknown>>(
  system: string,
  user: string,
  fallback: T
): Promise<T> {
  const res = await ai(
    [
      { role: "system", content: system + "\n\nReturn ONLY valid JSON. No markdown, no explanation." },
      { role: "user", content: user },
    ],
    { maxTokens: 600 }
  )
  try {
    return JSON.parse(res.content) as T
  } catch {
    return fallback
  }
}

export function aiProviderStatus(): {
  vercel_gateway: boolean
  groq: boolean
  openai: boolean
  active_provider: string
} {
  const hasGateway = !!process.env.VERCEL_OIDC_TOKEN
  const hasGroq = !!process.env.GROQ_API_KEY
  const hasOAI = !!process.env.OPENAI_API_KEY
  return {
    vercel_gateway: hasGateway,
    groq: hasGroq,
    openai: hasOAI,
    active_provider: hasGateway ? "vercel_gateway" : hasGroq ? "groq" : hasOAI ? "openai" : "static",
  }
}
