# BUSINESS FACTORY — SEPARATE REPO SPEC
# Builder Doc 10 | Strategic-Minds/Business-Factory

## PURPOSE
The Business Factory is a second autonomous system running alongside Agent Zero.
While Agent Zero is the AI brain, the Business Factory is the revenue engine.
Separate GitHub repo + separate Vercel project for isolation.

## REPO: Strategic-Minds/Business-Factory
## VERCEL PROJECT: business-factory (separate deployment)

## ARCHITECTURE
Business Factory has ONE mission: generate revenue for XPS Intelligence.
It operates 24/7 autonomously, generating leads, sending outreach,
booking calls, following up, and reporting results.

## MODULES

### Module 1: Lead Factory
- Runs every 5 minutes (*/5 cron)
- Scrapes Arizona epoxy/flooring contractors from:
  - Google Maps API (places near search)
  - Yelp API
  - BBB (Better Business Bureau)
  - AZ Corporation Commission
  - Angi/HomeAdvisor listings
- Deduplicates, scores, stores
- Target: 200+ new qualified leads/week

### Module 2: Outreach Factory
- Runs every 15 minutes
- Takes top 10 uncontacted leads
- Generates personalized 3-touch sequence
- Stores draft for Jeremy approval (L4)
- On approval: schedules sends

### Module 3: Follow-Up Factory
- Runs daily at 10am
- Checks all leads contacted 3+ days ago
- Generates follow-up message
- Sends if auto-approved in settings

### Module 4: Proposal Factory
- On demand via webhook
- Takes lead_id → generates full XPS proposal
- Branded HTML + PDF
- Direct share link generated

### Module 5: Reporting Factory
- Daily 7am summary
- Weekly Monday report
- Monthly pipeline analysis
- Revenue projections based on pipeline value

### Module 6: CRM Sync Factory
- Supabase ↔ HubSpot sync every hour
- Keeps both systems in sync
- Resolves conflicts via timestamp

## STACK
Next.js 14 · Vercel Pro · Supabase (shared with Agent Zero) · GitHub Actions

## TIMELINE
- Week 1: Repo creation + Lead Factory + Reporting
- Week 2: Outreach Factory + Proposal Factory
- Week 3: CRM Sync + Follow-Up Factory
- Week 4: Full integration with Agent Zero orchestrator
