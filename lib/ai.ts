/**
 * AI GATEWAY ABSTRACTION — Vercel AI Gateway + OpenAI fallback
 * Handles both Vercel AI Gateway and direct OpenAI keys transparently
 */

export interface AIMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface AIOptions {
  maxTokens?: number
  temperature?: number
  jsonMode?: boolean
}

async function ai(messages: AIMessage[], opts: AIOptions = {}): Promise<{ content: string; usage?: { promptTokens: number; completionTokens: number } }> {
  const token = process.env.VERCEL_AI_GATEWAY_TOKEN || process.env.OPENAI_API_KEY
  if (!token) throw new Error("No AI token configured (VERCEL_AI_GATEWAY_TOKEN or OPENAI_API_KEY)")

  const url = process.env.VERCEL_AI_GATEWAY_TOKEN
    ? "https://api.vercel.ai/openai/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions"

  const body: Record<string, unknown> = {
    model: "gpt-4o-mini",
    messages,
    max_tokens: opts.maxTokens || 1000,
    temperature: opts.temperature || 0.7,
  }
  if (opts.jsonMode) body.response_format = { type: "json_object" }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) throw new Error(`AI API error: ${res.status}`)
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens: number; completion_tokens: number } }
    return {
      content: data.choices?.[0]?.message?.content || "",
      usage: data.usage ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens } : undefined,
    }
  } catch (err) {
    console.error("AI call failed:", err)
    throw err
  }
}

export async function aiText(system: string, user: string): Promise<string> {
  const res = await ai([{ role: "system", content: system }, { role: "user", content: user }])
  return res.content
}

export async function aiJSON<T = Record<string, unknown>>(system: string, user: string, fallback: T): Promise<T> {
  const res = await ai(
    [{ role: "system", content: system + " Return ONLY valid JSON, no markdown." }, { role: "user", content: user }],
    { maxTokens: 600, jsonMode: true }
  )
  try { return JSON.parse(res.content) as T } catch { return fallback }
}

export async function aiScore(company_data: string): Promise<number> {
  const system = "Score this company as a sales lead 0-100. Return ONLY a number."
  const result = await aiText(system, company_data)
  const match = result.match(/\d+/)
  return match ? Math.min(100, Math.max(0, parseInt(match[0]))) : 50
}
