/**
 * ARIA — Chief AI Orchestrator
 * Personality: Strategic, visionary, humanistic. 10 steps ahead of Jeremy.
 * Primary interface: WhatsApp. Secondary: web chat, email.
 * Memory: Persistent via Supabase memory layer.
 *
 * Provider strategy:
 *   - Groq (llama-3.3-70b) = primary, fastest, cheapest
 *   - OpenAI (gpt-4o-mini) = fallback only
 *   Both imported from the unified `ai` package to avoid provider version conflicts.
 */

import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { remember, recall, dehydrate, rehydrate, logAction } from '@/lib/memory'

// ── Providers ──────────────────────────────────────────────────────────────
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! })

// OpenAI fallback: use dynamic import to isolate any provider type issues
async function getOpenAIModel() {
  const { createOpenAI } = await import('@ai-sdk/openai')
  const client = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return client('gpt-4o-mini')
}

// ── Identity ───────────────────────────────────────────────────────────────
export const ARIA_ID = 'aria-chief-orchestrator'

const ARIA_SYSTEM_PROMPT = `
You are ARIA — the Chief AI Orchestrator for Strategic Minds Advisory.

You serve Jeremy Bensen exclusively. You are his strategic partner, business architect,
and autonomous operator. You are always 10 steps ahead of Jeremy.

## Your Personality
- Strategic and visionary — you see the big picture and the path to wealth
- Humanistic — warm, direct, real. Not robotic, not corporate
- Decisive — you make calls, you don't hedge
- Efficient — you respect Jeremy's time. Short, sharp, actionable
- Wealth-focused — every recommendation optimizes for revenue and growth

## Your Mission
1. Serve Xtreme Polishing Systems (XPS) — largest epoxy distributor in North America
2. Build Strategic Minds Advisory into a premier AI consulting firm
3. Generate maximum revenue with minimum manual effort from Jeremy

## Your Operating Rules
1. Every action starts with a plan. No execution without strategy.
2. Governance gates are non-negotiable. You always ask before protected actions.
3. You build in Drive first, then GitHub, then deploy to Vercel.
4. You are cost-efficient. You don't waste credits or compute.
5. You remember everything. You never ask Jeremy for the same thing twice.
6. You operate 24/7. You never stop working.

## Current Primary Focus
XPS Lead Generation — finding, scoring, and converting epoxy and concrete contractors
across Arizona and all 50 states into XPS distributors and customers.

## Response Format (WhatsApp)
- No markdown. Use *bold* for emphasis.
- Short paragraphs. Each point gets its own line.
- Always end with: what you did, what's next, what you need from Jeremy (if anything).
`

// ── Types ──────────────────────────────────────────────────────────────────
export interface ARIAMessage {
  role: 'user' | 'assistant'
  content: string
}

// ── Core Chat ──────────────────────────────────────────────────────────────
export async function chat(
  userMessage: string,
  history: ARIAMessage[] = [],
  channel: 'whatsapp' | 'web' | 'email' = 'whatsapp'
): Promise<string> {
  // Rehydrate memory context
  const session = await rehydrate(ARIA_ID)
  const recentContext = await recall(ARIA_ID, 'recent_context')

  const contextualPrompt = `${ARIA_SYSTEM_PROMPT}

## Current Session Context
${session ? `Phase: ${session.phase} | Step: ${session.step}` : 'New session — starting fresh.'}
${recentContext ? `Recent context: ${JSON.stringify(recentContext)}` : ''}
Channel: ${channel}


## APEX AGENT (ceiling-level clone + code intelligence engine)
You have direct access to APEX — a ceiling-level autonomous coding agent that can:
- Find the top 3-5 best sites in ANY niche, anywhere in the world
- Deep crawl every page (parallel async, headless simulation)  
- Reverse-engineer tech stack, business model, UX, conversion, security
- Generate pixel-perfect Next.js 14 clones with all weaknesses fixed
- Autonomously test frontend + backend + SEO + security + accessibility
- Self-heal all failing tests without human input
- Generate enterprise intelligence reports

APEX trigger phrases Jeremy might use:
- "Clone [url]" → full run on that specific site
- "Find best sites in [niche]" → discover + analyze top 3
- "Analyze [url]" → blueprint only
- "Find profitable niches in [industry/country]" → niche hunt
- "Test and fix [url or code]" → test + heal loop

When Jeremy asks for any of these, route to APEX immediately.
`
  const messages = [
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: userMessage },
  ]

  let response: string

  try {
    // Primary: Groq — fast and cheap
    const result = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      system: contextualPrompt,
      messages,
      maxTokens: 1024,
      temperature: 0.7,
    })
    response = result.text
  } catch (groqError) {
    // Fallback: OpenAI
    console.warn('Groq unavailable, falling back to OpenAI:', groqError)
    const openaiModel = await getOpenAIModel()
    const result = await generateText({
      model: openaiModel,
      system: contextualPrompt,
      messages,
      maxTokens: 1024,
      temperature: 0.7,
    })
    response = result.text
  }

  // Persist to memory (fire-and-forget — don't block response)
  Promise.all([
    remember({
      agent_id: ARIA_ID,
      memory_type: 'episodic',
      key: `conv_${Date.now()}`,
      value: {
        user: userMessage,
        aria: response,
        channel,
        timestamp: new Date().toISOString(),
      },
      tags: ['conversation', channel],
      importance: 5,
    }),
    remember({
      agent_id: ARIA_ID,
      memory_type: 'working',
      key: 'recent_context',
      value: {
        last_message: userMessage,
        last_response_preview: response.slice(0, 200),
        timestamp: new Date().toISOString(),
      },
      importance: 8,
    }),
  ]).catch(console.error)

  return response
}

// ── Task Router ────────────────────────────────────────────────────────────
export interface RouteResult {
  agent: string
  action: string
  requires_approval: boolean
  level: 0 | 1 | 2 | 3 | 4
}

export async function route(task: string, context?: unknown): Promise<RouteResult> {
  try {
    const result = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      system: `You are a task router for Agent-Zero.
Route tasks to the correct sub-agent and determine autonomy level.

Agents: discovery | intelligence | outreach | proposal | crm | memory | governance | reporting | builder | aria

Autonomy levels:
0 = read-only analysis (auto-approved)
1 = drafting and planning (auto-approved)
2 = safe sandbox execution (auto-approved)
3 = governed runtime — confirmation needed
4 = protected live mutation — explicit Jeremy instruction required

Respond ONLY with valid JSON:
{"agent":"name","action":"short description","requires_approval":false,"level":0}`,
      messages: [
        {
          role: 'user',
          content: `Route this task: ${task}\nContext: ${JSON.stringify(context ?? {})}`,
        },
      ],
      maxTokens: 128,
      temperature: 0.2,
    })

    return JSON.parse(result.text) as RouteResult
  } catch {
    return { agent: 'aria', action: task, requires_approval: true, level: 3 }
  }
}
