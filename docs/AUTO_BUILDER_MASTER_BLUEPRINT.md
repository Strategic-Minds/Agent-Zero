# AUTO BUILDER SYSTEM — MASTER BLUEPRINT
# Target: 99% Independent Audit Score
# Current: 58/100 | Target: 99/100 | Gap: 41 points
# Version: 1.0 | Generated: Auto | Maintained: Auto

## MISSION
Transform Agent Zero from PROTOTYPE (58/100) to FAANG ELITE (99/100)
through a fully autonomous build-validate-fix-evolve loop.

## CURRENT GAPS (from Independent Audit)
Score: 58/100 | Grade: D | Tier: PROTOTYPE

Critical failures blocking progress:
- AI Intelligence: 39/100 (hallucinated leads, no real scraping)
- FAANG Parity: 36/100 (no Playwright, no vector memory, no real parallel)
- Business Value: 41/100 (WhatsApp not live, fake data pipeline)
- Observability: 44/100 (no Sentry, no external monitoring)

## PHASE 1: FOUNDATION FIXES (58 → 75, Days 1-7)
Target: Grade C+ | Tier: STAGING

### P1.1 — Real Web Scraping Engine
Files to create/modify:
- agents/discovery.ts (REWRITE — replace generateObject with fetch)
- lib/scraper.ts (NEW — real HTTP scraper with cheerio)
- app/api/cron/lead-discovery/route.ts (UPDATE — use real scraper)

Tools needed:
- cheerio (npm install cheerio) — HTML parsing
- OR firecrawl SDK (npm install @mendableai/firecrawl-js) — managed scraping

Sources to scrape:
- Google Maps Places API (free tier: 1k/month)
- Yelp Fusion API (free: 500 calls/day)
- BBB.org (public listings, no auth needed)
- AZ Corporation Commission (public API)
- Angi/HomeAdvisor (public listings)

Expected score impact: +12 points (AI Intelligence 39 → 65)

### P1.2 — Fix Parallel Orchestration
Files to modify:
- lib/orchestrator.ts (REWRITE fan-out logic)
- app/api/orchestrate/route.ts (UPDATE response shape)

Fix: Promise.all([ariaAgent, discoveryAgent, intelligenceAgent])
Return: merged results from all 3 agents simultaneously
Expected score impact: +8 points

### P1.3 — Sentry Error Monitoring
Files to create:
- sentry.client.config.ts (NEW)
- sentry.server.config.ts (NEW)
- sentry.edge.config.ts (NEW)
- next.config.js (UPDATE — add withSentryConfig)

Env vars needed: SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT
Expected score impact: +6 points (Observability 44 → 70)

### P1.4 — Rate Limiting (Upstash Ratelimit)
Files to create:
- lib/rate-limit.ts (NEW)
- middleware.ts (UPDATE — add rate limit check)

Tools: @upstash/ratelimit, @upstash/redis
Env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
Expected score impact: +4 points (Security 68 → 75)

## PHASE 2: INTELLIGENCE UPGRADE (75 → 88, Days 8-21)
Target: Grade B+ | Tier: ENTERPRISE

### P2.1 — Playwright Browser Automation
Files to create:
- agents/browser-real.ts (NEW — real Playwright)
- app/api/browser/route.ts (NEW endpoint)

Tools: playwright-core, @sparticuz/chromium-min
Vercel config: "functions": {"app/api/browser/**": {"memory": 1024}}
Expected score impact: +10 points (FAANG Parity 36 → 58)

### P2.2 — pgvector Semantic Memory
Files to create:
- lib/vector-memory.ts (NEW)
- supabase/migrations/009_pgvector.sql (NEW)

Tools: openai text-embedding-3-small
Supabase: enable pgvector extension
Expected score impact: +7 points (AI Intelligence 65 → 78)

### P2.3 — WhatsApp Business API Live
Files to modify:
- agents/aria.ts (UPDATE whatsapp channel handler)
- app/api/webhook/whatsapp/route.ts (NEW — inbound webhook)
- app/api/cron/daily-briefing/route.ts (UPDATE — real send)

Requirements:
- Meta Business Account verified
- WhatsApp Business API access approved
- WHATSAPP_BUSINESS_TOKEN env var set
- WHATSAPP_PHONE_NUMBER_ID env var set

Expected score impact: +6 points (Business Value 41 → 60)

### P2.4 — BullMQ Async Job Queue
Files to create:
- lib/queue.ts (NEW — BullMQ setup)
- workers/discovery-worker.ts (NEW)
- workers/scoring-worker.ts (NEW)
- workers/outreach-worker.ts (NEW)

Tools: bullmq, upstash redis (as queue broker)
Expected score impact: +8 points (Reliability 63 → 80)

### P2.5 — Auto Supabase Migrations in CI
Files to create:
- .github/workflows/deploy.yml (NEW or UPDATE)
- scripts/migrate.sh (NEW)

Expected score impact: +4 points (Data Integrity 51 → 65)

## PHASE 3: FAANG ELITE (88 → 99, Days 22-45)
Target: Grade A+ | Tier: FAANG ELITE

### P3.1 — Auto SOP System
Files to create:
- lib/sop-tracker.ts (NEW — tracks every agent action)
- agents/sop-agent.ts (NEW — normalizes + summarizes)
- app/api/sop/route.ts (NEW — SOP API)
- app/sop/page.tsx (NEW — SOP dashboard)
- app/api/cron/sop-summarize/route.ts (NEW — every 4hrs)

### P3.2 — Self-Reflection Loop
Files to create:
- agents/reflection-agent.ts (NEW)
- app/api/reflect/route.ts (NEW)
- app/api/cron/self-reflect/route.ts (NEW — every 4hrs)
- app/reflect/page.tsx (NEW — reflection dashboard)

### P3.3 — Evolution Agent
Files to create:
- agents/evolution-agent.ts (NEW — reads audit, writes builder docs, pushes code)
- app/api/evolve/route.ts (NEW)
- app/api/cron/evolve/route.ts (NEW — every 6hrs)

### P3.4 — Email Reporting (SendGrid/Resend)
Files to create:
- lib/email.ts (NEW — email sender)
- lib/report-formatter.ts (NEW — human-readable HTML reports)
- app/api/cron/email-report/route.ts (NEW — every 4hrs)

Tools: @sendgrid/mail OR resend SDK
Env vars: SENDGRID_API_KEY or RESEND_API_KEY, REPORT_EMAIL
Email target: strategicmindsadvisory@gmail.com

### P3.5 — Advanced Human Validator (Full Browser)
Files to modify:
- lib/headless-validator.ts (UPDATE — add real browser tests)
- agents/validator.ts (UPDATE — add conversation test)

Test additions:
- Full conversation flow (5+ message exchange)
- Universal Law topic research test
- Command/response validation
- Form fill and submission
- Page navigation via clicks

### P3.6 — Universal Law Governance Layer
Files to create:
- lib/governance.ts (NEW — Universal Law principles as system constraints)
- GOVERNANCE.md (NEW — documented principles)

Principles to encode:
- Cause and Effect: every action logged with consequences
- Correspondence: as above (intent) so below (execution)
- Rhythm: predictable cycles, consistent cron patterns
- Polarity: track both successes and failures equally
- Mentalism: system operates from clear stated purpose

### P3.7 — Streaming Chat (Vercel AI SDK)
Files to modify:
- app/api/aria/route.ts (UPDATE — use streamText)
- app/studio/page.tsx (UPDATE — use useChat hook for streaming)

### P3.8 — CORS + CSP Headers
Files to create:
- middleware.ts (UPDATE — add security headers)

### P3.9 — Unit Tests (Vitest)
Files to create:
- __tests__/aria.test.ts
- __tests__/orchestrator.test.ts
- __tests__/validator.test.ts
- vitest.config.ts

## COMPLETE FILE LIST (All files to create/modify)

### NEW FILES (34 total):
lib/scraper.ts
lib/vector-memory.ts
lib/queue.ts
lib/sop-tracker.ts
lib/email.ts
lib/report-formatter.ts
lib/governance.ts
agents/browser-real.ts
agents/sop-agent.ts
agents/reflection-agent.ts
agents/evolution-agent.ts
workers/discovery-worker.ts
workers/scoring-worker.ts
workers/outreach-worker.ts
app/api/browser/route.ts
app/api/sop/route.ts
app/api/reflect/route.ts
app/api/evolve/route.ts
app/api/webhook/whatsapp/route.ts
app/api/cron/sop-summarize/route.ts
app/api/cron/self-reflect/route.ts
app/api/cron/evolve/route.ts
app/api/cron/email-report/route.ts
app/sop/page.tsx
app/reflect/page.tsx
app/evolve/page.tsx
sentry.client.config.ts
sentry.server.config.ts
sentry.edge.config.ts
middleware.ts
scripts/migrate.sh
.github/workflows/deploy.yml
supabase/migrations/009_pgvector.sql
supabase/migrations/010_sop_tables.sql
GOVERNANCE.md

### MODIFIED FILES (12 total):
agents/discovery.ts (real scraping)
agents/aria.ts (WhatsApp live, streaming)
agents/browser.ts (Playwright real)
lib/orchestrator.ts (true parallel)
lib/auto-loop.ts (wire SOP + reflection)
lib/headless-validator.ts (full browser tests)
app/api/aria/route.ts (streaming)
app/api/orchestrate/route.ts (parallel results)
app/api/validate/route.ts (conversation test)
app/studio/page.tsx (streaming chat)
next.config.js (Sentry + browser)
vercel.json (add new crons)

## NEW CRON SCHEDULE (16 total):
*/5 * * * *    auto-loop (12-stage evolution)
*/15 * * * *   auto-heal
*/30 * * * *   triple-validate
0 */4 * * *    sop-summarize + email report
0 */4 * * *    self-reflect
0 */6 * * *    evolve (audit → builder docs → push)
0 11 * * *     lead-discovery
0 12 * * *     lead-scoring
0 13 * * *     daily-briefing
0 14 * * 1-5   outreach-followup
0 13 * * 1     weekly-report
0 8 * * *      benchmark
0 7 * * *      auto-install
0 3 * * *      full validation sweep

## NPM PACKAGES TO INSTALL:
cheerio                         (HTML scraping)
@mendableai/firecrawl-js        (managed scraping - optional)
playwright-core                 (browser automation)
@sparticuz/chromium-min         (Chromium for Vercel)
bullmq                         (async job queue)
@upstash/ratelimit             (rate limiting)
@upstash/redis                 (Redis client)
@sentry/nextjs                 (error monitoring)
resend                         (email sending)
openai                         (embeddings for pgvector)
vitest                         (unit testing)
@testing-library/react         (component testing)

## ENV VARS TO ADD:
SENTRY_DSN
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
RESEND_API_KEY (or SENDGRID_API_KEY)
REPORT_EMAIL (strategicmindsadvisory@gmail.com)
WHATSAPP_BUSINESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
GOOGLE_MAPS_API_KEY
YELP_API_KEY
FIRECRAWL_API_KEY (optional)

## SCORE PROJECTION:
Phase 1 complete: 58 → 75 (+17pts)
Phase 2 complete: 75 → 88 (+13pts)
Phase 3 complete: 88 → 99 (+11pts)

## WHATSAPP OUTBOUND — LEGAL NOTE
Meta prohibits cold outbound to opted-out users.
Compliant approach for AI consulting + XPS pitches:
1. Build landing page with WhatsApp opt-in CTA
2. Run Google/FB ads to landing page
3. Opted-in users enter CRM → outbound sequence begins
4. Use WhatsApp Business API for follow-up sequences
5. Stay within 24-hour messaging window rules
This is the path that does not get you banned.
