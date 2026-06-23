/**
 * AI CLIENT — Vercel AI Gateway primary
 * Priority: AI_GATEWAY_API_KEY (Vercel Gateway) > GROQ_API_KEY > OPENAI_API_KEY > static
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

function getGatewayProvider() {
  const key = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!key) return null;
  // Vercel AI Gateway is OpenAI-compatible
  return createOpenAI({
    baseURL: "https://ai.vercel.app/api/v1",
    apiKey: key,
  });
}

function getGroqProvider() {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  return createGroq({ apiKey: key });
}

function getOpenAIProvider() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return createOpenAI({ apiKey: key });
}

export async function ai(
  messages: ChatMessage[],
  options: { model?: string; maxTokens?: number } = {}
): Promise<AIResponse> {
  const maxTokens = options.maxTokens ?? 500;
  const model = options.model ?? "gpt-4o-mini";

  // 1. Vercel AI Gateway (AI_GATEWAY_API_KEY)
  const gateway = getGatewayProvider();
  if (gateway) {
    try {
      const { text } = await generateText({ model: gateway(model), messages, maxTokens });
      return { content: text, model, provider: "vercel_gateway" };
    } catch { /* fall through */ }
  }

  // 2. Groq (fast, free)
  const groq = getGroqProvider();
  if (groq) {
    try {
      const { text } = await generateText({
        model: groq("llama-3.1-70b-versatile"),
        messages,
        maxTokens,
      });
      return { content: text, model: "llama-3.1-70b-versatile", provider: "groq" };
    } catch { /* fall through */ }
  }

  // 3. OpenAI direct
  const oai = getOpenAIProvider();
  if (oai) {
    try {
      const { text } = await generateText({ model: oai(model), messages, maxTokens });
      return { content: text, model, provider: "openai" };
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
  const gw   = !!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
  const groq  = !!process.env.GROQ_API_KEY;
  const oai   = !!process.env.OPENAI_API_KEY;
  return {
    vercel_gateway: gw,
    groq,
    openai: oai,
    active_provider: gw ? "vercel_gateway" : groq ? "groq" : oai ? "openai" : "static",
  };
}

export function getActiveProvider(): string {
  return aiProviderStatus().active_provider;
}
