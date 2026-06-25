/**
 * AI ENGINE v9.0 — Vercel AI Gateway Primary
 * Waterfall: Vercel AI Gateway (groq/llama-3.3-70b) → Groq Direct → Static
 * Raw fetch only. No SDK. No adapters.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  provider: "vercel_gateway" | "groq" | "static";
}

const GATEWAY_URL      = "https://ai-gateway.vercel.sh/v1/chat/completions";
const GATEWAY_MODEL    = "groq/llama-3.3-70b-versatile";
const GATEWAY_FALLBACK = "anthropic/claude-3-5-haiku-20241022";
const GROQ_URL         = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL       = "llama-3.3-70b-versatile";

function withTimeout(ms: number): AbortController {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl;
}

async function callLLM(
  url: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<string | null> {
  const ctrl = withTimeout(18000);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7 }),
      signal: ctrl.signal,
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      console.error(`[AI] ${model} HTTP ${resp.status}: ${err.slice(0, 200)}`);
      return null;
    }
    const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : null;
  } catch (e) {
    const msg = String(e);
    if (!msg.includes("AbortError")) console.error(`[AI] ${model} fetch error: ${msg.slice(0, 200)}`);
    return null;
  }
}

export async function ai(
  messages: ChatMessage[],
  opts: { model?: string; maxTokens?: number } = {}
): Promise<AIResponse> {
  const maxTokens = Math.max(opts.maxTokens ?? 600, 16);

  // TIER 1: Vercel AI Gateway (primary)
  const gwKey = (process.env.AI_GATEWAY_API_KEY ?? "").trim();
  if (gwKey.length > 20) {
    const text = await callLLM(GATEWAY_URL, gwKey, GATEWAY_MODEL, messages, maxTokens);
    if (text) return { content: text, model: GATEWAY_MODEL, provider: "vercel_gateway" };
    console.error("[AI] Gateway primary failed — trying fallback model");
    const text2 = await callLLM(GATEWAY_URL, gwKey, GATEWAY_FALLBACK, messages, maxTokens);
    if (text2) return { content: text2, model: GATEWAY_FALLBACK, provider: "vercel_gateway" };
    console.error("[AI] Gateway fallback also failed — dropping to Groq direct");
  }

  // TIER 2: Groq direct fallback
  const groqKey = (process.env.GROQ_API_KEY ?? "").trim();
  if (groqKey.length > 20) {
    const text = await callLLM(GROQ_URL, groqKey, GROQ_MODEL, messages, maxTokens);
    if (text) return { content: text, model: GROQ_MODEL, provider: "groq" };
    console.error("[AI] Groq direct also failed");
  }

  // TIER 3: Static fallback
  return { content: "AI service temporarily unavailable. Please try again in a moment.", model: "none", provider: "static" };
}

export async function aiChat(system: string, user: string, opts?: { model?: string; maxTokens?: number }): Promise<AIResponse> {
  return ai([{ role: "system", content: system }, { role: "user", content: user }], opts);
}

export async function aiText(system: string, user: string): Promise<string> {
  return (await aiChat(system, user)).content;
}

export async function aiJSON<T = Record<string, unknown>>(system: string, user: string, fallback: T): Promise<T> {
  const r = await ai([
    { role: "system", content: system + "\n\nReturn ONLY valid JSON. No markdown, no code blocks." },
    { role: "user", content: user },
  ], { maxTokens: 800 });
  try { return JSON.parse(r.content) as T; } catch { return fallback; }
}

export function aiProviderStatus() {
  const gw   = (process.env.AI_GATEWAY_API_KEY ?? "").trim().length > 20;
  const groq = (process.env.GROQ_API_KEY ?? "").trim().length > 20;
  const active = gw ? "vercel_gateway" : groq ? "groq" : "static";
  return {
    vercel_gateway: gw,
    groq,
    openai: false,
    active_provider: active,
    gateway_model: GATEWAY_MODEL,
    groq_model: GROQ_MODEL,
  };
}

export function getActiveProvider(): string {
  return aiProviderStatus().active_provider;
}