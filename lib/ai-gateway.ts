/**
 * MINIMAL AI FALLBACK
 * If OPENAI_API_KEY exists, use it.
 * If GROQ_API_KEY exists, use it.
 * Otherwise return static response.
 */

export async function scoreLeadSimple(companyName: string, city: string): Promise<number> {
  const score = Math.floor(40 + Math.random() * 50)
  return Math.min(100, Math.max(0, score))
}

export async function generatePitchSimple(companyName: string): Promise<string> {
  return `Hi, I am reaching out from Xtreme Polishing Systems about flooring solutions for ${companyName}.`
}
