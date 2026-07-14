import { NextResponse } from "next/server";

export const maxDuration = 60;

const AI_GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const MODEL_NAME = "groq/llama-3.3-70b-versatile";

// Timeout helper using AbortController
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function callLLM(prompt: string, jsonMode: boolean = false): Promise<string> {
  const apiKey = process.env.AI_GATEWAY_API_KEY || "";
  const response = await fetchWithTimeout(
    AI_GATEWAY_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          { role: "system", content: "You are a professional lead scoring assistant. Always return valid JSON." },
          { role: "user", content: prompt }
        ],
        response_format: jsonMode ? { type: "json_object" } : undefined,
        temperature: 0.1,
      }),
    },
    18000 // 18 seconds timeout for LLM scoring calls
  );

  if (!response.ok) {
    throw new Error(`LLM call failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function querySupabase(path: string, options: RequestInit = {}): Promise<any> {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
  
  const headers = {
    "Content-Type": "application/json",
    "apikey": supabaseKey,
    "Authorization": `Bearer ${supabaseKey}`,
    ...options.headers,
  };

  const response = await fetchWithTimeout(
    `${supabaseUrl}${path}`,
    { ...options, headers },
    10000 // 10 seconds timeout for DB operations
  );

  if (!response.ok) {
    throw new Error(`Supabase query failed: ${response.statusText}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("x-cron-secret");
    if (authHeader !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch unscored leads (lead_score is null or negative placeholder)
    // Limits fetch batch to 15 to stay within cron execution limits safely
    const unscoredLeads = await querySupabase("/rest/v1/leads?lead_score=is.null&limit=15", {
      method: "GET",
    });

    if (!unscoredLeads || unscoredLeads.length === 0) {
      return NextResponse.json({ success: true, scored_count: 0, message: "No unscored leads found." });
    }

    let scoredCount = 0;
    const scoredSummary = [];

    // 2. Score each lead using LLM via AI Gateway
    for (const lead of unscoredLeads) {
      try {
        const leadDescription = `Company: ${lead.company_name || "Unknown"}
Industry: ${lead.industry || "Unknown"}
Website: ${lead.website || "None"}
Phone: ${lead.phone || "None"}
Email: ${lead.email || "None"}`;

        const prompt = `Score this lead from 0 to 100 based strictly on quality.
Evaluation Criteria:
1. Has phone number (+20 pts)
2. Has email (+20 pts)
3. Has website (+20 pts)
4. Company name quality/realness (+20 pts)
5. Alignment with target construction/contractor industry (+20 pts)

Lead Data:
${leadDescription}

Return JSON format:
{
  "score": <number>,
  "rationale": "string explanation"
}`;

        const llmResultRaw = await callLLM(prompt, true);
        const llmResult = JSON.parse(llmResultRaw);
        const score = Math.max(0, Math.min(100, Number(llmResult.score) || 0));

        // 3. Update lead score in Supabase
        await querySupabase(`/rest/v1/leads?id=eq.${lead.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            lead_score: score,
            scoring_rationale: llmResult.rationale,
            updated_at: new Date().toISOString(),
          }),
        });

        scoredCount++;
        scoredSummary.push({ id: lead.id, name: lead.company_name, score });
      } catch (e: any) {
        console.error(`Error scoring lead ID ${lead.id}:`, e.message);
      }
    }

    return NextResponse.json({
      success: true,
      scored_count: scoredCount,
      summary: scoredSummary,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
