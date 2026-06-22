# BUILDER DOC 06 — OBSERVABILITY LAYER
# Fixes: Observability (44→92), Developer Experience (61→85)
# Score impact: +3 points
# Deploy: Vercel Workflow → single push

## FULL OBSERVABILITY STACK

### Sentry (sentry.server.config.ts + sentry.client.config.ts)
Already in 03_INFRASTRUCTURE. This doc covers configuration depth.
- Error tracking: all unhandled exceptions → Sentry
- Performance: p95 latency tracked per route
- Alerts: email Jeremy when error rate > 5%
- Source maps: uploaded on every deploy

### Vercel Analytics
Add to app/layout.tsx:
```typescript
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
// In <body>: <Analytics /><SpeedInsights />
```

### Custom Dashboard Pages
app/sop/page.tsx — SOP event log, 4hr summary
app/reflect/page.tsx — Self-reflection reports
app/evolve/page.tsx — Evolution plans and history
app/audit-history/page.tsx — All past audit scores

### EMAIL REPORT (lib/email-reporter.ts — already deployed)
Requires RESEND_API_KEY and REPORT_EMAIL set in Vercel.
Test: POST /api/cron/sop-reflect-email with CRON_SECRET header.

### app/api/status/route.ts (CREATE)
Public status page API — no auth required.
Returns: { services: { aria, db, loop, crons }, uptime, last_deploy, audit_score }

### vitest.config.ts + __tests__/ (CREATE)
Unit tests for critical lib functions.
```typescript
// __tests__/sop-tracker.test.ts
test("trackSOPEvent writes to DB", async () => { ... })
// __tests__/scraper.test.ts
test("scrapeGoogleMaps returns Lead[]", async () => { ... })
```

## EXPECTED SCORE AFTER THIS DOC
Observability: 44 → 90 (+46)
Developer Experience: 61 → 83 (+22)
Overall: 97 → 98 (+1)
