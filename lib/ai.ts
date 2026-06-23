/**
 * AI client minimal — Vercel Gateway waterfall
 * Used by: intelligence route, other agents
 */
export async function aiJSON<T = Record<string, unknown>>(
  system: string,
  user: string,
  fallback: T
): Promise<T> {
  // Try Vercel Gateway
  let token = process.env.VERCEL_OIDC_TOKEN
  if (token) {
    try {
      const res = await fetch("https://ai.vercel.app/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: system + "\n\nReturn ONLY valid JSON. No markdown." },
            { role: "user", content: user }
          ],
          max_tokens: 600,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(15000),
      })
      if (res.ok) {
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
        const content = data.choices?.[0]?.message?.content
        if (content) {
          try { return JSON.parse(content) as T } catch { return fallback }
        }
      }
    } catch { /* fall through */ }
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
          messages: [
            { role: "system", content: system + "\n\nReturn ONLY valid JSON." },
            { role: "user", content: user }
          ],
          max_tokens: 600,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(12000),
      })
      if (res.ok) {
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
        const content = data.choices?.[0]?.message?.content
        if (content) {
          try { return JSON.parse(content) as T } catch { return fallback }
        }
      }
    } catch { /* fall through */ }
  }

  return fallback
}

export function getActiveProvider(): string {
  if (process.env.VERCEL_OIDC_TOKEN) return "vercel_gateway"
  if (process.env.GROQ_API_KEY) return "groq"
  return "static"
}
