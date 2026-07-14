import { NextResponse } from "next/server";

export const maxDuration = 60;

const AI_GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const MODEL_NAME = "groq/llama-3.3-70b-versatile";

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
          { role: "system", content: "You are a professional web data extraction bot. Extract and clean data to valid JSON." },
          { role: "user", content: prompt }
        ],
        response_format: jsonMode ? { type: "json_object" } : undefined,
        temperature: 0.1,
      }),
    },
    18000 // 18 seconds timeout for LLM structuring
  );

  if (!response.ok) {
    throw new Error(`LLM Structuring failed: ${response.status}`);
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
    10000 // 10 seconds timeout
  );

  if (!response.ok) {
    throw new Error(`Supabase query failed: ${response.statusText}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function cleanDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { industry, topics, location, max_results = 10 } = body;

    if (!industry || !topics || !location) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const tKey = process.env.TAVILY_API_KEY || "";
    const allResults: any[] = [];

    // Create scrape run record
    const runId = "run_" + Math.random().toString(36).substring(2, 11);
    const scrapeRun = {
      run_id: runId,
      industry,
      location,
      status: "running",
      created_at: new Date().toISOString(),
    };

    try {
      await querySupabase("/rest/v1/scrape_runs", {
        method: "POST",
        body: JSON.stringify(scrapeRun),
      });
    } catch (e: any) {
      console.error("Failed to initialize scrape run record:", e.message);
    }

    // Call Tavily Search API for each topic
    for (const topic of topics) {
      const query = `${industry} ${topic} in ${location} contractors`;
      try {
        const tResponse = await fetchWithTimeout(
          "https://api.tavily.com/search",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              api_key: tKey,
              query,
              search_depth: "advanced",
              max_results: max_results,
              include_domains: [],
              include_answer: false,
            }),
          },
          10000 // 10 seconds timeout for search calls
        );

        if (tResponse.ok) {
          const searchData = await tResponse.json();
          if (searchData.results) {
            allResults.push(...searchData.results);
          }
        }
      } catch (err: any) {
        console.error(`Tavily search failed for topic: ${topic}:`, err.message);
      }
    }

    let totalFound = 0;
    let newLeadsCount = 0;
    let duplicatesSkipped = 0;

    const domainsProcessed = new Set<string>();

    for (const item of allResults) {
      totalFound++;
      const domain = cleanDomain(item.url);
      if (!domain || domainsProcessed.has(domain)) {
        duplicatesSkipped++;
        continue;
      }
      domainsProcessed.add(domain);

      // Check for domain duplicates in Supabase
      try {
        const existing = await querySupabase(`/rest/v1/leads?website=ilike.*${domain}*`, { method: "GET" });
        if (existing && existing.length > 0) {
          duplicatesSkipped++;
          continue;
        }
      } catch (e) {
        // Continue if check fails
      }

      // LLM extracts structured data
      try {
        const extractionPrompt = `Extract precise, structured lead information from the search result.
Source URL: ${item.url}
Title: ${item.title}
Content snippet: ${item.content}

Strictly extract: company_name, phone, email, website (or URL), and physical address. Keep null if not explicitly found.
Return structured JSON:
{
  "company_name": "string or null",
  "phone": "string or null",
  "email": "string or null",
  "website": "string or null",
  "address": "string or null"
}`;

        const extractRaw = await callLLM(extractionPrompt, true);
        const info = JSON.parse(extractRaw);

        // Save to Supabase
        await querySupabase("/rest/v1/leads", {
          method: "POST",
          body: JSON.stringify({
            company_name: info.company_name || item.title || "Unknown Lead",
            phone: info.phone || null,
            email: info.email || null,
            website: info.website || item.url,
            address: info.address || null,
            industry,
            category: topics[0] || "General",
            location,
            source_url: item.url,
            lead_score: null, // Scored during scoring job
            scrape_run_id: runId,
            created_at: new Date().toISOString(),
          }),
        });

        newLeadsCount++;
      } catch (e: any) {
        console.error(`Failed to process lead from result ${item.url}:`, e.message);
      }
    }

    // Update scrape run details
    try {
      await querySupabase(`/rest/v1/scrape_runs?run_id=eq.${runId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "completed",
          total_found: totalFound,
          new_leads: newLeadsCount,
          duplicates_skipped: duplicatesSkipped,
          completed_at: new Date().toISOString(),
        }),
      });
    } catch (e: any) {
      console.error("Failed to update scrape run record:", e.message);
    }

    return NextResponse.json({
      run_id: runId,
      total_found: totalFound,
      new_leads: newLeadsCount,
      duplicates_skipped: duplicatesSkipped,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
