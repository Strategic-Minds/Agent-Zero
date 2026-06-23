/**
 * VERCEL AI GATEWAY - Central AI client
 * Uses Vercel AI SDK (already installed)
 * Priority: Vercel AI Gateway (OIDC) > Groq SDK > OpenAI SDK > static
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

// Vercel AI Gateway - uses VERCEL_OIDC_TOKEN auto-injected by Vercel
// Compatible endpoint with OpenAI SDK format
function getGatewayProvider() {
  const token = process.env.VERCEL_OIDC_TOKEN;
  if (!token) return null;
  return createOpenAI({
    baseURL: "https://ai.vercel.app/api/v1",
    apiKey: token,
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

  // 1. Try Vercel AI Gateway first
  const gateway = getGatewayProvider();
  if (gateway) {
    try {
      const { text } = await generateText({
        model: gateway(options.model ?? "gpt-4o-mini"),
        messages,
        maxTokens,
      });
      return { content: text, model: options.model ?? "gpt-4o-mini", provider: "vercel_gateway" };
    } catch { /* fall through */ }
  }

  // 2. Groq fallback (GROQ_API_KEY is set in Vercel)
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
      const { text } = await generateText({
        model: oai(options.model ?? "gpt-4o-mini"),
        messages,
        maxTokens,
      });
      return { content: text, model: options.model ?? "gpt-4o-mini", provider: "openai" };
    } catch { /* fall through */ }
  }

  // 4. Static fallback
  return { content: "AI unavailable - please try again shortly.", model: "static", provider: "static" };
}

export async function aiChat(
  system: string,
  user: string,
  options?: { model?: string; maxTokens?: number }
): Promise<AIResponse> {
  return ai([{ role: "system", content: system }, { role: "user", content: user }], options);
}

export async function aiText(system: string, user: string): Promise<string> {
  const r = await aiChat(system, user);
  return r.content;
}

export async function aiJSON<T = Record<string, unknown>>(
  system: string,
  user: string,
  fallback: T
): Promise<T> {
  const jsonSystem = system + "\n\nReturn ONLY valid JSON. No markdown, no explanation.";
  const r = await ai(
    [{ role: "system", content: jsonSystem }, { role: "user", content: user }],
    { maxTokens: 600 }
  );
  try { return JSON.parse(r.content) as T; } catch { return fallback; }
}

export function aiProviderStatus(): {
  vercel_gateway: boolean;
  groq: boolean;
  openai: boolean;
  active_provider: string;
} {
  const gw = !!process.env.VERCEL_OIDC_TOKEN;
  const groq = !!process.env.GROQ_API_KEY;
  const oai = !!process.env.OPENAI_API_KEY;
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
