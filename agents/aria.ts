/**
 * ARIA — Simple stub for now
 * Real implementation uses WhatsApp outreach directly
 */

export interface ARIARequest {
  message: string
  conversation_id?: string
  company_id?: string
  context?: string
}

export interface ARIAResponse {
  reply: string
  conversation_id: string
}

export async function runARIA(req: ARIARequest): Promise<ARIAResponse> {
  return {
    reply: "ARIA response (stub mode)",
    conversation_id: req.conversation_id || `aria_${Date.now()}`,
  }
}

export async function ariaWhatsAppReply(message: string, company_name: string, context: string): Promise<string> {
  return `Hi, I am reaching out from Xtreme Polishing Systems about flooring solutions for ${company_name}.`
}
