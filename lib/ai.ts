/**
 * AI CLIENT — Groq primary (active) + Vercel AI Gateway (vck_ key — server-side pending OIDC)
 * Priority: GROQ_API_KEY → OPENAI_API_KEY → Vercel Gateway → static
 * Groq model: llama-3.3-70b-versatile (llama-3.1-70b decommissioned June 2026)
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

function getGroqProvider() {
  const key = process.env.GROQ_API_KEY;
  if (!key || key.length < 10) return null;
  return createGroq({ apiKey: key });
}

function getOpenAIProvider() {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.length < 10) return null;
  return createOpenAI({ apiKey: key });
}

function getGatewayProvider() {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key || key.length < 10) return null;
  const baseURL = process.env.AI_GATEWAY_BASE_URL || "https://gateway.ai.vercel.app/v1";
  return createOpenAI({ baseURL, apiKey: key });
}

export async function ai(
  messages: ChatMessage[],
  options: { model?: string; maxTokens?: number } = {}
): Promise<AIResponse> {
  const maxTokens = options.maxTokens ?? 500;
  const model = options.model ?? "gpt-4o-mini";

  // 1. Groq — fastest, confirmed working
  const groq = getGroqProvider();
  if (groq) {
    try {
      const { text } = await generateText({ model: groq(GROQ_MODEL), messages, maxTokens });
      if (text?.length > 0) return { content: text, model: GROQ_MODEL, provider: "groq" };
    } catch { /* fall through */ }
  }

  // 2. OpenAI direct
  const oai = getOpenAIProvider();
  if (oai) {
    try {
      const { text } = await generateText({ model: oai(model), messages, maxTokens });
      if (text?.length > 0) return { content: text, model, provider: "openai" };
    } catch { /* fall through */ }
  }

  // 3. Vercel AI Gateway (vck_ key — works in Vercel runtime via OIDC context)
  const gateway = getGatewayProvider();
  if (gateway) {
    try {
      const { text } = await generateText({ model: gateway(model), messages, maxTokens });
      if (text?.length > 0) return { content: text, model, provider: "vercel_gateway" };
    } catch { /* fall through */ }
  }

  return { content: "AI unavailable — please try again shortly.", model: "static", provider: "static" };
}

export async function aiChat(
  system: string,
  user: string,
  options?: { model?: string; maxTokens?: number }
): Promise<AIResponse> {
  return ai([{ role: "system", content: system }, { role: "user", content: user }], options);
}

export async function aiText(system: string, user: string): Promise<string> {
  return (await aiChat(system, user)).content;
}

export async function aiJSON<T = Record<string, unknown>>(
  system: string,
  user: string,
  fallback: T
): Promise<T> {
  const r = await ai(
    [{ role: "system", content: system + "\n\nReturn ONLY valid JSON. No markdown." },
     { role: "user", content: user }],
    { maxTokens: 600 }
  );
  try { return JSON.parse(r.content) as T; } catch { return fallback; }
}

export function aiProviderStatus() {
  const gwKey = process.env.AI_GATEWAY_API_KEY || "";
  const gw   = gwKey.length >= 10;
  const groq  = (process.env.GROQ_API_KEY || "").length >= 10;
  const oai   = (process.env.OPENAI_API_KEY || "").length >= 10;
  return {
    vercel_gateway: gw,
    groq,
    openai: oai,
    active_provider: groq ? "groq" : oai ? "openai" : gw ? "vercel_gateway" : "static",
    groq_model: GROQ_MODEL,
    gateway_key_prefix: gwKey.substring(0, 6) || "none",
  };
}

export function getActiveProvider(): string {
  return aiProviderStatus().active_provider;
}
