/**
 * VERCEL AI GATEWAY — Central AI client
 * No OpenAI key needed. Vercel auto-injects auth via OIDC.
 * Falls back to Groq if gateway unavailable, then to static responses.
 * Drop-in OpenAI-compatible API.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface AIResponse {
  content: string
  model: string
  provider: "vercel_gateway" | "groq" | "static"
  tokens?: number
}

// Vercel AI Gateway — openai-compatible, no key needed in Vercel runtime
const VERCEL_GATEWAY_URL = "https://ai.vercel.app/api/v1"

async function callVercelGateway(messages: ChatMessage[], model = "gpt-4o-mini", maxTokens = 500): Promise<string | null> {
  // Vercel injects VERCEL_OIDC_TOKEN automatically in runtime
  const token = process.env.VERCEL_OIDC_TOKEN
  if (!token) return null

  try {
    const res = await fetch(`${VERCEL_GATEWAY_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7 }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content || null
  } catch { return null }
}

async function callGroq(messages: ChatMessage[], maxTokens = 500): Promise<string | null> {
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

async function callOpenAI(messages: ChatMessage[], model = "gpt-4o-mini", maxTokens = 500): Promise<string | null> {
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

/**
 * Main AI call — waterfall: Vercel Gateway → Groq → OpenAI → static
 */
export async function ai(messages: ChatMessage[], options: {
  model?: string; maxTokens?: number; jsonMode?: boolean
} = {}): Promise<AIResponse> {
  const { model = "gpt-4o-mini", maxTokens = 500 } = options

  // 1. Try Vercel AI Gateway first (no key needed)
  const gateway = await callVercelGateway(messages, model, maxTokens)
  if (gateway) return { content: gateway, model, provider: "vercel_gateway" }

  // 2. Groq fallback (free tier, fast)
  const groq = await callGroq(messages, maxTokens)
  if (groq) return { content: groq, model: "llama-3.1-70b", provider: "groq" }

  // 3. OpenAI direct fallback
  const openai = await callOpenAI(messages, model, maxTokens)
  if (openai) return { content: openai, model, provider: "openai" }

  // 4. Static fallback — never fails
  return { content: "AI response unavailable — please try again shortly.", model: "static", provider: "static" }
}

/**
 * Convenience: single system + user message
 */
export async function aiChat(system: string, user: string, options?: { model?: string; maxTokens?: number }): Promise<AIResponse> {
  return ai([{ role: "system", content: system }, { role: "user", content: user }], options)
}

/**
 * JSON mode — parses response as JSON with fallback
 */
export async function aiJSON<T = Record<string, unknown>>(system: string, user: string, fallback: T): Promise<T> {
  const res = await ai(
    [{ role: "system", content: system + "

Return ONLY valid JSON, no markdown." }, { role: "user", content: user }],
    { maxTokens: 600 }
  )
  try { return JSON.parse(res.content) as T } catch { return fallback }
}

export function aiProviderStatus() {
  return {
    vercel_gateway: !!process.env.VERCEL_OIDC_TOKEN,
    groq: !!process.env.GROQ_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    active_provider: process.env.VERCEL_OIDC_TOKEN ? "vercel_gateway" : process.env.GROQ_API_KEY ? "groq" : process.env.OPENAI_API_KEY ? "openai" : "static",
  }
}
