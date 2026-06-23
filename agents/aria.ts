/**
 * ARIA - Autonomous Reasoning Intelligence Agent
 * Uses Vercel AI Gateway (no OpenAI key needed)
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
  conversation_id: string;
  provider: string;
  toolsUsed: string[];
}

const ARIA_SYSTEM = `You are ARIA, the AI assistant for Xtreme Polishing Systems (XPS).
XPS is a commercial epoxy flooring and concrete polishing company in Arizona.
Be professional, concise, and action-oriented.
Always move toward booking a free site assessment or closing a deal.`;

export async function chat(
  message: string,
  history: ARIAMessage[] = [],
  conversation_id?: string,
  context?: string
): Promise<ARIAResult> {
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
  return {
    reply: res.content,
    response: res.content,
    conversation_id: convId,
    provider: res.provider,
    toolsUsed: ["vercel_ai_gateway"],
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
  const system = "You are the autonomous sales assistant for Xtreme Polishing Systems (XPS). " +
    "Replying to WhatsApp from: " + company_name + ". Context: " + context + ". " +
    "Keep reply under 100 words. Goal: qualify lead and book free site assessment.";
  const res = await aiChat(system, message, { maxTokens: 150 });
  return res.content;
}
