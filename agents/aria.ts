/**
 * ARIA - Autonomous Reasoning Intelligence Agent
 * Vercel AI Gateway primary | Groq | OpenAI | static fallback
 */
import { aiChat } from "@/lib/ai";
import { getSupabaseAdmin } from "@/lib/supabase";

export interface ARIAMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ARIAResult {
  reply: string;
  response: string;
  content: string;
  conversation_id: string;
  provider: string;
  model: string;
  toolsUsed: string[];
  tokens?: number;
  latency_ms?: number;
  latencyMs?: number;
}

const ARIA_SYSTEM = `You are ARIA, the AI assistant for Xtreme Polishing Systems (XPS).
XPS does commercial epoxy flooring and concrete polishing in Arizona.
Be professional, concise, action-oriented.
Goal: book free site assessment or close a deal.`;

export async function chat(
  message: string,
  history: ARIAMessage[] = [],
  conversation_id?: string,
  context?: string
): Promise<ARIAResult> {
  const start = Date.now();
  const system = context ? ARIA_SYSTEM + "\n\nContext: " + context : ARIA_SYSTEM;
  const res = await aiChat(system, message, { model: "gpt-4o-mini", maxTokens: 600 });

  try {
    const db = getSupabaseAdmin();
    await db.from("call_logs" as any).insert({
      company_name: "ARIA Session",
      call_date: new Date().toISOString(),
      call_outcome: "aria_chat",
      call_notes: "Q: " + message.slice(0, 150) + " | A: " + res.content.slice(0, 150),
      ai_call_summary: "Provider: " + res.provider,
    });
  } catch { /* non-fatal */ }

  const convId = conversation_id || ("aria_" + Date.now());
  const elapsed = Date.now() - start;
  return {
    reply: res.content,
    response: res.content,
    content: res.content,
    conversation_id: convId,
    provider: res.provider,
    model: res.model,
    toolsUsed: ["vercel_ai_gateway"],
    latency_ms: elapsed,
    latencyMs: elapsed,
  };
}

export async function runARIA(req: {
  message: string;
  conversation_id?: string;
  company_id?: string;
  context?: string;
}): Promise<ARIAResult> {
  return chat(req.message, [], req.conversation_id, req.context);
}

export async function ariaWhatsAppReply(
  message: string,
  company_name: string,
  context: string
): Promise<string> {
  const system = "Sales assistant for XPS (epoxy flooring AZ). " +
    "Replying to " + company_name + ". Context: " + context +
    ". Under 100 words. Goal: book free site assessment.";
  const res = await aiChat(system, message, { maxTokens: 150 });
  return res.content;
}
