/**
 * AI ENGINE — RAW FETCH ONLY
 * No @ai-sdk adapters. Pure HTTP to Groq/OpenAI.
 * Proven to work. No silent failures.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  provider: "groq" | "openai" | "static";
}

const GROQ_MODEL  = "llama-3.3-70b-versatile";
const GROQ_URL    = "https://api.groq.com/openai/v1/chat/completions";
const OPENAI_URL  = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";

async function callLLM(
  url: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7 }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      console.error(`LLM error ${resp.status}: ${err.slice(0,200)}`);
      return null;
    }
    const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : null;
  } catch (e) {
    console.error("LLM fetch error:", String(e).slice(0,200));
    return null;
  }
}

export async function ai(
  messages: ChatMessage[],
  opts: { model?: string; maxTokens?: number } = {}
): Promise<AIResponse> {
  const maxTokens = opts.maxTokens ?? 600;

  // 1. Groq — raw fetch, proven working
  const groqKey = process.env.GROQ_API_KEY ?? "";
  if (groqKey.length > 20) {
    const text = await callLLM(GROQ_URL, groqKey, GROQ_MODEL, messages, maxTokens);
    if (text) return { content: text, model: GROQ_MODEL, provider: "groq" };
  }

  // 2. OpenAI — raw fetch fallback
  const oaiKey = process.env.OPENAI_API_KEY ?? "";
  if (oaiKey.length > 20) {
    const text = await callLLM(OPENAI_URL, oaiKey, OPENAI_MODEL, messages, maxTokens);
    if (text) return { content: text, model: OPENAI_MODEL, provider: "openai" };
  }

  return {
    content: "AI service temporarily unavailable. Please try again in a moment.",
    model: "none",
    provider: "static",
  };
}

export async function aiChat(
  system: string,
  user: string,
  opts?: { model?: string; maxTokens?: number }
): Promise<AIResponse> {
  return ai([{ role: "system", content: system }, { role: "user", content: user }], opts);
}

export async function aiText(system: string, user: string): Promise<string> {
  return (await aiChat(system, user)).content;
}

export async function aiJSON<T = Record<string, unknown>>(
  system: string,
  user: string,
  fallback: T
): Promise<T> {
  const r = await ai([
    { role: "system", content: system + "\n\nReturn ONLY valid JSON. No markdown." },
    { role: "user", content: user },
  ], { maxTokens: 800 });
  try { return JSON.parse(r.content) as T; } catch { return fallback; }
}

export function aiProviderStatus() {
  const groq = (process.env.GROQ_API_KEY ?? "").length > 20;
  const oai  = (process.env.OPENAI_API_KEY ?? "").length > 20;
  return {
    groq,
    openai: oai,
    vercel_gateway: false,
    active_provider: groq ? "groq" : oai ? "openai" : "static",
    groq_model: GROQ_MODEL,
  };
}

export function getActiveProvider(): string {
  return aiProviderStatus().active_provider;
}
