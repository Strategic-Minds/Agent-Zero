# BUILDER DOC 01 — INTELLIGENCE LAYER
# Fixes: AI Intelligence (39→95), FAANG Parity (36→80)
# Score impact: +28 points
# Deploy: Vercel Workflow → single push

## FILES TO CREATE/MODIFY

### lib/scraper.ts (CREATE)
Real web scraping engine. No LLM hallucination.

```typescript
// Sources: Google Maps Places API, Yelp Fusion, BBB, AZ Corp Commission
export async function scrapeGoogleMaps(query: string, location: string): Promise<Lead[]>
export async function scrapeYelp(term: string, location: string): Promise<Lead[]>
export async function scrapeBBB(category: string, city: string): Promise<Lead[]>
export async function scrapeAZRegistry(keyword: string): Promise<Lead[]>
```

ENV VARS: GOOGLE_MAPS_API_KEY, YELP_API_KEY

### agents/discovery.ts (MODIFY)
Replace generateObject() with real scraper calls.

BEFORE: const result = await generateObject({ schema, prompt: "find contractors in Arizona" })
AFTER:
```typescript
const [googleLeads, yelpLeads, bbbLeads] = await Promise.all([
  scrapeGoogleMaps("epoxy flooring contractor", "Arizona"),
  scrapeYelp("epoxy flooring", "Phoenix, AZ"),
  scrapeBBB("flooring", "Phoenix"),
])
const leads = deduplicateLeads([...googleLeads, ...yelpLeads, ...bbbLeads])
```

### lib/orchestrator.ts (MODIFY)
Fix fan-out — currently fires 1 agent. Must fire ALL simultaneously.

BEFORE: const result = await ariaAgent(task)
AFTER:
```typescript
const [ariaResult, discoveryResult, intelligenceResult, outreachResult] = await Promise.all([
  ariaAgent(task).catch(e => ({ error: String(e) })),
  discoveryAgent(task).catch(e => ({ error: String(e) })),
  intelligenceAgent(task).catch(e => ({ error: String(e) })),
  outreachAgent(task).catch(e => ({ error: String(e) })),
])
return mergeAgentResults([ariaResult, discoveryResult, intelligenceResult, outreachResult])
```

### lib/vector-memory.ts (CREATE)
pgvector semantic memory for ARIA.

```typescript
export async function embedText(text: string): Promise<number[]>   // OpenAI text-embedding-3-small
export async function storeMemory(content: string, metadata: Record<string,string>): Promise<void>
export async function recallMemory(query: string, limit = 5): Promise<Memory[]>
export async function buildRAGContext(query: string): Promise<string>  // Top 5 memories as context
```

ENV VARS: OPENAI_API_KEY (for embeddings)
SUPABASE: enable pgvector extension, create embeddings table

### agents/aria.ts (MODIFY)
Add RAG context injection before every response.

```typescript
// Before generateText:
const ragContext = await buildRAGContext(message).catch(() => "")
const fullPrompt = ragContext ? `Context from memory:
${ragContext}

User: ${message}` : message
```

### lib/router.ts (MODIFY)
Add tool-use capability to withSmartRetry.

```typescript
export const TOOLS = {
  search_web: tool({ description: "Search the web", parameters: z.object({ query: z.string() }), execute: async ({ query }) => await webSearch(query) }),
  get_leads: tool({ description: "Get leads from DB", parameters: z.object({ limit: z.number() }), execute: async ({ limit }) => await getLeads(limit) }),
  score_lead: tool({ description: "Score a lead", parameters: z.object({ lead_id: z.string() }), execute: async ({ lead_id }) => await scoreLead(lead_id) }),
}
```

## VERCEL AGENTS USAGE
Use Vercel AI SDK v4 `useAgent()` hook for streaming.
Each agent runs as a Vercel serverless function with `maxDuration: 300`.
Parallel agent calls use `Promise.all()` across separate fetch() calls to agent endpoints.

## EXPECTED SCORE AFTER THIS DOC
AI Intelligence: 39 → 82 (+43)
FAANG Parity: 36 → 60 (+24)
Business Value: 41 → 65 (+24)
Overall: 58 → 74 (+16)
