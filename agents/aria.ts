/**
 * ARIA — Chief AI Orchestrator
 * Personality: Strategic, visionary, humanistic. 10 steps ahead of Jeremy.
 * Primary interface: WhatsApp. Secondary: web chat, email.
 * Memory: Persistent via Supabase memory layer.
 */

import { generateText, streamText } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { createOpenAI } from '@ai-sdk/openai'
import { remember, recall, dehydrate, rehydrate, logAction } from '@/lib/memory'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

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

export interface ARIAMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function chat(
  userMessage: string,
  history: ARIAMessage[] = [],
  channel: 'whatsapp' | 'web' | 'email' = 'whatsapp'
): Promise<string> {
  // Rehydrate memory context
  const session = await rehydrate(ARIA_ID)
  const recentContext = await recall(ARIA_ID, 'recent_context')

  // Build context-aware system prompt
  const contextualPrompt = `${ARIA_SYSTEM_PROMPT}
  
## Current Session Context
${session ? `Phase: ${session.phase} | Step: ${session.step}` : 'New session'}
${recentContext ? `Recent context: ${JSON.stringify(recentContext)}` : ''}
Channel: ${channel}
`

  try {
    // Use Groq for speed (primary)
    const result = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      system: contextualPrompt,
      messages: [
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage }
      ],
      maxTokens: 1024,
      temperature: 0.7
    })

    const response = result.text

    // Save to memory
    await remember({
      agent_id: ARIA_ID,
      memory_type: 'episodic',
      key: `conversation_${Date.now()}`,
      value: { user: userMessage, aria: response, channel, timestamp: new Date().toISOString() },
      tags: ['conversation', channel],
      importance: 5
    })

    // Update session context
    await remember({
      agent_id: ARIA_ID,
      memory_type: 'working',
      key: 'recent_context',
      value: {
        last_message: userMessage,
        last_response_preview: response.slice(0, 200),
        timestamp: new Date().toISOString()
      },
      importance: 8
    })

    return response

  } catch (groqError) {
    // Fallback to OpenAI
    console.error('Groq failed, falling back to OpenAI:', groqError)

    const result = await generateText({
      model: openai('gpt-4o-mini'),
      system: contextualPrompt,
      messages: [
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage }
      ],
      maxTokens: 1024,
      temperature: 0.7
    })

    return result.text
  }
}

// Route a task to the appropriate sub-agent
export async function route(task: string, context?: any): Promise<{
  agent: string
  action: string
  requires_approval: boolean
  level: 0 | 1 | 2 | 3 | 4
}> {
  const routingResult = await generateText({
    model: groq('llama-3.3-70b-versatile'),
    system: `You are a task router for Agent-Zero. 
    Route tasks to the correct agent and determine autonomy level.
    
    Agents: discovery, intelligence, outreach, proposal, crm, memory, governance, reporting, builder
    
    Autonomy levels:
    0 = read-only (auto-approved)
    1 = drafting/planning (auto-approved)  
    2 = sandbox execution (auto-approved)
    3 = governed runtime (confirmation needed)
    4 = protected live mutation (explicit Jeremy instruction required)
    
    Respond in JSON: {"agent": "name", "action": "description", "requires_approval": bool, "level": 0-4}`,
    messages: [{ role: 'user', content: `Route this task: ${task}\nContext: ${JSON.stringify(context)}` }],
    maxTokens: 256
  })

  try {
    return JSON.parse(routingResult.text)
  } catch {
    return { agent: 'aria', action: task, requires_approval: true, level: 3 }
  }
}
