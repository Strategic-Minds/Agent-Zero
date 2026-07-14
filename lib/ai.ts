const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';
const GATEWAY_MODEL = 'groq/llama-3.3-70b-versatile';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  provider: 'vercel_gateway' | 'groq' | 'static';
}

function withTimeout(ms: number): AbortController {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl;
}

async function callLLM(
  url: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<string | null> {
  const ctrl = withTimeout(18000);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7
      }),
      signal: ctrl.signal,
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => '');
      console.error(`[AI] ${model} HTTP ${resp.status}: ${err.slice(0, 200)}`);
      return null;
    }
    const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error(`[AI] ${model} fetch error:`, e);
    return null;
  }
}

export async function ai(
  messages: ChatMessage[],
  opts: { model?: string; maxTokens?: number } = {}
): Promise<AIResponse> {
  const maxTokens = opts.maxTokens ?? 1000;

  // 1. Vercel AI Gateway (Primary)
  const gwKey = (process.env.AI_GATEWAY_API_KEY ?? '').trim();
  if (gwKey) {
    const text = await callLLM(GATEWAY_URL, gwKey, GATEWAY_MODEL, messages, maxTokens);
    if (text) return { content: text, model: GATEWAY_MODEL, provider: 'vercel_gateway' };
  }

  // 2. Groq Direct (Fallback)
  const groqKey = (process.env.GROQ_API_KEY ?? '').trim();
  if (groqKey) {
    const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
    const text = await callLLM(groqUrl, groqKey, 'llama-3.3-70b-versatile', messages, maxTokens);
    if (text) return { content: text, model: 'llama-3.3-70b-versatile', provider: 'groq' };
  }

  // 3. Static Fallback
  return {
    content: 'Fallback: XPS AI Gateway is currently unreachable. Please check configuration.',
    model: 'none',
    provider: 'static'
  };
}

export async function aiChat(system: string, user: string, opts?: { model?: string; maxTokens?: number }): Promise<AIResponse> {
  return ai([{ role: 'system', content: system }, { role: 'user', content: user }], opts);
}

export async function aiJSON<T = Record<string, any>>(system: string, user: string, fallback: T): Promise<T> {
  const r = await ai([
    { role: 'system', content: system + '\n\nReturn ONLY a valid JSON object. Do not include markdown blocks, backticks, or other preamble.' },
    { role: 'user', content: user }
  ], { maxTokens: 1000 });
  try {
    let clean = r.content.trim();
    if (clean.startsWith('```json')) clean = clean.substring(7);
    if (clean.startsWith('```')) clean = clean.substring(3);
    if (clean.endsWith('```')) clean = clean.substring(0, clean.length - 3);
    return JSON.parse(clean.trim()) as T;
  } catch (e) {
    console.error('[AI] JSON parse failed, returning fallback:', e, r.content);
    return fallback;
  }
}
