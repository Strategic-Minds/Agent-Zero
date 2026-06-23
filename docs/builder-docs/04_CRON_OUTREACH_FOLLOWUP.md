# Automation Workflow Builder Doc

## Workflow Name
/api/cron/outreach-followup — WhatsApp Outreach Automation

## Trigger
Weekdays at 2:00 PM UTC (9 AM ET): `0 14 * * 1-5`

## Business Outcome
S-tier and A-tier leads receive a WhatsApp message automatically. Cold calling is fully replaced. Previous XPS clients receive reactivation messages.

## Inputs
- S-tier + A-tier leads from Supabase (phone not null, outreach_sent IS NULL)
- META_WHATSAPP_TOKEN (env)
- META_PHONE_NUMBER_ID (env)
- Approved WhatsApp message templates (from Meta Business Manager)
- agents/outreach.ts + agents/whatsapp.ts

## Systems Involved
- agents/outreach.ts — decides who to contact, composes message
- agents/whatsapp.ts — sends via Meta WhatsApp Cloud API
- Supabase companies table — marks outreach_sent, logs result
- agents/reflection.ts — post-run reflection

## Steps
1. Auth check
2. Import runOutreach from agents/outreach
3. Pull top 20 S-tier leads (phone not null, outreach_sent IS NULL)
4. For each lead: compose personalized WhatsApp template message
5. Send via whatsapp.sendTemplate() — parallel for all leads
6. Update companies: set outreach_sent=true, outreach_date=now, outreach_channel="whatsapp"
7. Log results to Supabase outreach_log table
8. Run reflect()
9. Return { sent, failed, leads }

## AI Enhancements
Groq generates personalized message for each lead based on ai_profile_summary and category_guess.
Example: "Hi [Name], we specialize in [service] for businesses like yours in [city]..."

## Manual Work Replaced
Sales reps making cold calls. Completely replaced by WhatsApp automation.

## Approval Gates
- MUST have approved Meta message template before any send
- Daily send limit: 20 messages (avoid Meta spam flags)
- NEVER send to same number twice in 7 days

## Failure Paths
- META_WHATSAPP_TOKEN missing: log error, alert Jeremy, skip run
- Meta API error: retry once, log failure, do not retry same lead same day
- Lead phone format invalid: skip lead, flag for manual review

## Receipts
Supabase outreach_log: { company_id, channel: "whatsapp", sent_at, template_used, status }
companies row: outreach_sent=true, outreach_date

## Monitoring
- Message count in daily briefing
- Response rate tracked in outreach_log
- Alert Jeremy on any 4xx/5xx from Meta API

## Rollback
Set outreach_sent=NULL on companies rows to re-queue for next cycle

## Vercel Workflow Notes
- maxDuration: 60s
- Requires META_WHATSAPP_TOKEN + META_PHONE_NUMBER_ID secrets
- Template must be pre-approved by Meta (24-48h)
