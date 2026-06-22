# N8N WORKFLOW TEMPLATES — Agent Zero Enterprise

## Overview
These n8n templates connect Agent Zero to 500+ external services.
Import any template directly into your n8n instance.

## TEMPLATE CATALOG

### CRM & SALES
- `lead-capture.json` — New lead → score → HubSpot → WhatsApp alert
- `follow-up-sequence.json` — Timed outreach cadence automation
- `deal-closed.json` — Closed deal → invoice → Slack celebration

### COMMUNICATION
- `whatsapp-broadcast.json` — Bulk WhatsApp to lead segments
- `email-drip.json` — Email sequence triggered by CRM stage
- `slack-daily-briefing.json` — 9am briefing from Agent Zero to Slack

### INTELLIGENCE
- `competitor-scan.json` — Weekly competitor site scan → report
- `google-alerts-scrape.json` — Monitor keywords → ingest leads
- `linkedin-prospect.json` — LinkedIn new connection → enrich → CRM

### OPERATIONS
- `invoice-reminder.json` — Overdue → WhatsApp + email + log
- `calendar-prep.json` — 30min before meeting → pull context → brief
- `weekly-report.json` — Sunday midnight → full business report → send

## SETUP

1. Install n8n: `npx n8n` or use n8n.cloud
2. Set webhook URL to your Vercel endpoint: `https://your-app.vercel.app/api/bridge`
3. Set Authorization header: `Bearer YOUR_BRIDGE_SECRET`
4. Import template JSON files from this directory
5. Activate workflows

## WEBHOOK ENDPOINTS (for n8n to call Agent Zero)

POST /api/bridge
Headers: Authorization: Bearer BRIDGE_SECRET
Body: { "command": "aria.chat", "message": "your instruction" }

POST /api/swarm  
Body: { "template": "lead_blitz" }

POST /api/aria
Body: { "message": "...", "channel": "n8n" }
