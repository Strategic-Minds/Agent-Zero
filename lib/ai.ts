/**
 * AI ENGINE v2 — Groq primary, all fallbacks guarded
 * GROQ: llama-3.3-70b-versatile (3.1 decommissioned Jun 2026)
 */
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGroq } from "@ai-sdk/groq";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
export interface AIResponse {
  content: string;
  model: string;
  provider: "vercel_gateway" | "groq" | "openai" | "static";
}

const GROQ_MODEL = "llama-3.3-70b-versatile";

export async function ai(
  messages: ChatMessage[],
  opts: { model?: string; maxTokens?: number } = {}
): Promise<AIResponse> {
  const maxTokens = opts.maxTokens ?? 600;
  const oaiModel  = opts.model ?? "gpt-4o-mini";

  // 1 — Groq (always uses GROQ_MODEL — Groq rejects OpenAI model names)
  const groqKey = process.env.GROQ_API_KEY ?? "";
  if (groqKey.length > 20) {
    try {
      const groq = createGroq({ apiKey: groqKey });
      const { text } = await generateText({ model: groq(GROQ_MODEL), messages, maxTokens });
      if (text && text.length > 2) return { content: text, model: GROQ_MODEL, provider: "groq" };
    } catch { /* fall through */ }
  }

  // 2 — OpenAI direct
  const oaiKey = process.env.OPENAI_API_KEY ?? "";
  if (oaiKey.length > 20) {
    try {
      const oai = createOpenAI({ apiKey: oaiKey });
      const { text } = await generateText({ model: oai(oaiModel), messages, maxTokens });
      if (text && text.length > 2) return { content: text, model: oaiModel, provider: "openai" };
    } catch { /* fall through */ }
  }

  // 3 — Vercel AI Gateway (vck_ key)
  const gwKey = process.env.AI_GATEWAY_API_KEY ?? "";
  if (gwKey.length > 20) {
    try {
      const gw = createOpenAI({
        baseURL: "https://gateway.ai.vercel.app/v1",
        apiKey: gwKey,
      });
      const { text } = await generateText({ model: gw(oaiModel), messages, maxTokens });
      if (text && text.length > 2) return { content: text, model: oaiModel, provider: "vercel_gateway" };
    } catch { /* fall through */ }
  }

  return { content: "AI unavailable — please try again shortly.", model: "none", provider: "static" };
}

export async function aiChat(system: string, user: string, opts?: { model?: string; maxTokens?: number }): Promise<AIResponse> {
  return ai([{ role: "system", content: system }, { role: "user", content: user }], opts);
}
export async function aiText(system: string, user: string): Promise<string> {
  return (await aiChat(system, user)).content;
}
export async function aiJSON<T = Record<string, unknown>>(system: string, user: string, fallback: T): Promise<T> {
  const r = await ai(
    [{ role: "system", content: system + "\n\nReturn ONLY valid JSON. No markdown fences." },
     { role: "user", content: user }],
    { maxTokens: 800 }
  );
  try { return JSON.parse(r.content) as T; } catch { return fallback; }
}
export function aiProviderStatus() {
  const gw   = (process.env.AI_GATEWAY_API_KEY  ?? "").length > 20;
  const groq  = (process.env.GROQ_API_KEY         ?? "").length > 20;
  const oai   = (process.env.OPENAI_API_KEY        ?? "").length > 20;
  return {
    vercel_gateway: gw, groq, openai: oai,
    active_provider: groq ? "groq" : oai ? "openai" : gw ? "vercel_gateway" : "static",
    groq_model: GROQ_MODEL,
  };
}
export function getActiveProvider() { return aiProviderStatus().active_provider; }
