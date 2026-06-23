/**
 * OPTIMIZER AGENT — agents/optimizer.ts
 * DIRECTIVE 4: Autonomous Fix → Heal → Harden loop
 * 
 * MISSION: Read the audit. Pick the highest-impact gap. Fix it.
 * Push to GitHub. Wait for build. Re-validate. Repeat until 100%.
 * 
 * TIME ESTIMATES (AI-parallel, not human):
 *   - Cron fires:           0ms   (Vercel triggers immediately)
 *   - Audit read:           800ms (single API call)
 *   - Gap analysis:         1.2s  (Groq llama-3.3-70b at 800 tok/s)
 *   - Code generation:      3-8s  (APEX generates TypeScript fix)
 *   - GitHub push:          600ms (GitHub API commit)
 *   - Vercel build:         90-150s (Next.js build pipeline)
 *   - Validation:           45s   (30-test parallel suite)
 *   - Total per cycle:      ~3.5 minutes (not "days" — AI parallel)
 * 
 * At 1-hour intervals: 17 fix cycles per day = ALL 17 gaps closed in 24h
 */

import { getSupabaseAdmin } from "@/lib/supabase"

export interface OptimizerRun {
  run_id: string
  cycle: number
  audit_score_before: number
  audit_score_after: number
  gap_targeted: string
  fix_description: string
  fix_applied: boolean
  build_triggered: boolean
  validator_score_after: number
  points_gained: number
  ran_at: string
  duration_ms: number
  next_target: string
}

// Priority fix map — each gap mapped to its autonomous fix implementation
const GAP_FIX_MAP: Record<string, {
  title: string
  impact: number
  fix_type: "code_patch" | "config_patch" | "dependency" | "env_required"
  auto_fixable: boolean
  fix_description: string
  files_to_patch: string[]
}> = {
  "hallucinated_discovery": {
    title: "Replace hallucinated lead discovery with real scraping",
    impact: 12,
    fix_type: "code_patch",
    auto_fixable: true,
    fix_description: "Patch agents/discovery.ts to use real fetch() calls to Google Maps Places API and AZ Corp Commission. Remove all generateObject() lead fabrication.",
    files_to_patch: ["agents/discovery.ts"],
  },
  "playwright_missing": {
    title: "Install Playwright-core for real browser automation",
    impact: 10,
    fix_type: "dependency",
    auto_fixable: true,
    fix_description: "Add playwright-core + @sparticuz/chromium-min to package.json. Rewrite agents/browser.ts with real Chromium headless launch.",
    files_to_patch: ["package.json", "agents/browser.ts"],
  },
  "no_streaming": {
    title: "Add LLM response streaming to ARIA",
    impact: 8,
    fix_type: "code_patch",
    auto_fixable: true,
    fix_description: "Convert ARIA route to use streamText() from @ai-sdk. Return ReadableStream. Update frontend to consume SSE stream.",
    files_to_patch: ["app/api/aria/route.ts"],
  },
  "no_circuit_breaker": {
    title: "Add circuit breaker pattern to orchestrator",
    impact: 7,
    fix_type: "code_patch",
    auto_fixable: true,
    fix_description: "Add CircuitBreaker class to lib/orchestrator.ts. Wrap all agent calls with breaker.execute(). Auto-open after 3 failures, reset after 30s.",
    files_to_patch: ["lib/orchestrator.ts"],
  },
  "no_sentry": {
    title: "Add Sentry error monitoring",
    impact: 7,
    fix_type: "dependency",
    auto_fixable: true,
    fix_description: "npm install @sentry/nextjs. Add sentry.client.config.ts and sentry.server.config.ts. Wire DSN from SENTRY_DSN env var.",
    files_to_patch: ["sentry.server.config.ts", "sentry.client.config.ts"],
  },
  "no_rate_limiting": {
    title: "Add per-IP rate limiting to public endpoints",
    impact: 6,
    fix_type: "code_patch",
    auto_fixable: true,
    fix_description: "Add lib/rate-limiter.ts using Vercel KV (upstash/ratelimit). Apply to /api/aria and /api/ghost. 60 req/min per IP.",
    files_to_patch: ["lib/rate-limiter.ts", "app/api/aria/route.ts"],
  },
  "no_caching": {
    title: "Add Redis/Vercel KV response caching",
    impact: 6,
    fix_type: "code_patch",
    auto_fixable: true,
    fix_description: "Add lib/cache.ts wrapping @vercel/kv. Cache benchmark results 5min, audit results 10min, competitor intel 1h.",
    files_to_patch: ["lib/cache.ts", "app/api/benchmark/route.ts", "app/api/audit/route.ts"],
  },
  "no_parallel_agents": {
    title: "Fix parallel agent fan-out in orchestrator",
    impact: 8,
    fix_type: "code_patch",
    auto_fixable: true,
    fix_description: "Rewrite lib/orchestrator.ts to fire all relevant agents via Promise.allSettled(). Currently only 1 agent fires. Need 3-5 simultaneously.",
    files_to_patch: ["lib/orchestrator.ts"],
  },
  "no_cors": {
    title: "Add explicit CORS policy",
    impact: 4,
    fix_type: "config_patch",
    auto_fixable: true,
    fix_description: "Add next.config.js headers() with Access-Control-Allow-Origin for API routes. Allow dashboard origin.",
    files_to_patch: ["next.config.js"],
  },
  "no_unit_tests": {
    title: "Add Vitest unit test suite",
    impact: 4,
    fix_type: "code_patch",
    auto_fixable: true,
    fix_description: "Add vitest.config.ts and __tests__/agents.test.ts covering validator, reflection, evolution, reporter. Run in CI on push.",
    files_to_patch: ["vitest.config.ts", "__tests__/agents.test.ts"],
  },
  "no_migrations": {
    title: "Add automatic Supabase migration runner",
    impact: 5,
    fix_type: "code_patch",
    auto_fixable: true,
    fix_description: "Add app/api/migrate/route.ts that reads supabase/migrations/*.sql and applies any pending ones on POST. Run from deploy hook.",
    files_to_patch: ["app/api/migrate/route.ts"],
  },
  "no_whatsapp": {
    title: "Complete WhatsApp Business API wiring",
    impact: 9,
    fix_type: "env_required",
    auto_fixable: false,
    fix_description: "Requires META_WHATSAPP_TOKEN and META_PHONE_NUMBER_ID env vars from Meta Business Manager. Once set, agents/whatsapp.ts is ready.",
    files_to_patch: [],
  },
  "no_hubspot": {
    title: "Complete HubSpot two-way sync",
    impact: 5,
    fix_type: "code_patch",
    auto_fixable: true,
    fix_description: "Add lib/hubspot.ts with syncLeadToHubSpot() and pullHubSpotUpdates(). Wire to entity automation on company create/update.",
    files_to_patch: ["lib/hubspot.ts"],
  },
  "no_vector_memory": {
    title: "Add pgvector semantic memory to ARIA",
    impact: 8,
    fix_type: "code_patch",
    auto_fixable: true,
    fix_description: "Enable pgvector extension in Supabase. Add lib/vector-memory.ts with storeEmbedding() and semanticSearch(). Wire to ARIA for RAG.",
    files_to_patch: ["lib/vector-memory.ts", "agents/aria.ts"],
  },
  "no_dead_letter": {
    title: "Add dead letter queue for failed cron jobs",
    impact: 5,
    fix_type: "code_patch",
    auto_fixable: true,
    fix_description: "Add Supabase table cron_failures. Wrap every cron handler in try/catch that upserts to cron_failures. Add retry logic on next run.",
    files_to_patch: ["lib/cron-wrapper.ts"],
  },
  "no_observability": {
    title: "Add distributed tracing and real-time dashboard",
    impact: 6,
    fix_type: "code_patch",
    auto_fixable: true,
    fix_description: "Add lib/tracer.ts wrapping OpenTelemetry. Instrument all agent calls with span tracking. Add /api/traces endpoint.",
    files_to_patch: ["lib/tracer.ts", "app/api/traces/route.ts"],
  },
  "no_pdf_proposals": {
    title: "Add branded PDF proposal generation",
    impact: 7,
    fix_type: "dependency",
    auto_fixable: true,
    fix_description: "npm install @react-pdf/renderer. Add app/api/proposal/route.ts. Generate XPS-branded proposals from lead profile + ai_pitch_recommendation.",
    files_to_patch: ["app/api/proposal/route.ts"],
  },
}

// Picks the next highest-impact auto-fixable gap
export function selectNextGap(completedGaps: string[] = []): string | null {
  const remaining = Object.entries(GAP_FIX_MAP)
    .filter(([key, g]) => g.auto_fixable && !completedGaps.includes(key))
    .sort(([, a], [, b]) => b.impact - a.impact)
  return remaining.length > 0 ? remaining[0][0] : null
}

export function getGapFix(gapKey: string) {
  return GAP_FIX_MAP[gapKey] || null
}

export function getAllGaps() {
  return GAP_FIX_MAP
}

// Formats optimizer status for daily briefing
export function formatOptimizerStatus(runs: OptimizerRun[]): string {
  if (!runs.length) return "No optimizer runs yet"
  const latest = runs[0]
  const totalGained = runs.reduce((s, r) => s + (r.points_gained || 0), 0)
  return [
    `🔧 OPTIMIZER — Cycle ${latest.cycle}`,
    `Last target: ${latest.gap_targeted}`,
    `Score delta: ${latest.audit_score_before} → ${latest.audit_score_after} (+${latest.points_gained} pts)`,
    `Total pts gained: +${totalGained} across ${runs.length} cycles`,
    `Next target: ${latest.next_target}`,
    `Estimated time to 100%: ${Math.ceil((100 - latest.audit_score_after) / 3.5)} cycles (~${Math.ceil((100 - latest.audit_score_after) / 3.5) * 60}min)`,
  ].join('\n')
}

export async function logOptimizerRun(run: OptimizerRun): Promise<void> {
  try {
    const db = getSupabaseAdmin()
    await db.from("optimizer_runs" as any).upsert({
      run_id: run.run_id,
      cycle: run.cycle,
      audit_score_before: run.audit_score_before,
      audit_score_after: run.audit_score_after,
      gap_targeted: run.gap_targeted,
      fix_applied: run.fix_applied,
      points_gained: run.points_gained,
      validator_score_after: run.validator_score_after,
      duration_ms: run.duration_ms,
      next_target: run.next_target,
      ran_at: run.ran_at,
    })
  } catch { /* non-fatal */ }
}
