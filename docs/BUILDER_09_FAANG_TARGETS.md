# FAANG GRADE TARGETS — ROADMAP
# Builder Doc 09 | From Current State to A+

## CURRENT STATE (Post v3.4.2)
- Validator Score: tracking (run /api/validate to check)
- Agents Active: 8/8 routable
- Workflows Defined: 8
- Test Memory: LIVE
- Crons: 7 defined (upgrading to 10 with 5-min trigger)
- Real Web Scraping: PENDING (Phase 1)
- Playwright/Browser: PENDING (Phase 1)

## FAANG GRADE RUBRIC
A+ (100%): All 30 capabilities active, score ≥99%, real scraping, Playwright live, autonomous loop running
A  (95%+): 28+ capabilities, autonomous loop running, real leads discovered daily
B+ (90%+): 25+ capabilities, workflows running, test memory tracking
B  (85%+): Current approximate state
C  (<80%): Prototype — not production ready

## PHASE 1 TARGETS (This Week)
- Real web scraping in Discovery (Firecrawl or direct fetch)
- Playwright-core via Vercel Sandbox
- 5-minute cron enabled (Vercel Pro)
- Auto-loop: all 12 stages running
- Score target: 92%+

## PHASE 2 TARGETS (Next 2 Weeks)
- Business Factory repo (separate GitHub + Vercel)
- BullMQ async job queue (Upstash Redis)
- Full OpenAI Assistants API integration
- n8n workflow JSON export for all 8 workflows
- Score target: 97%+

## PHASE 3 TARGETS (Month 1)
- Google Drive sync
- Full WhatsApp Business API (inbound webhook)
- Vercel Agents native integration
- Shadow background worker (persistent async)
- Score target: 99%+ / Grade A+

## PER-CAPABILITY TARGETS
All 30 capabilities must reach status: ACTIVE
Currently tracked in /api/benchmark and /capabilities page
Priority fixes:
1. Real web scraping → Discover 50+ real leads/day
2. Browser automation → Playwright live
3. Async queue → True parallel, not Promise.all()
4. Vector memory → Supabase pgvector for semantic search
5. Document intelligence → PDF parsing for proposals
