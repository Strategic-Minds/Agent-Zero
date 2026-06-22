# WORKFLOW CATALOG — ALL REPEATABLE WORKFLOWS
# Builder Doc 05 | n8n-Compatible Enterprise Workflows

## ACTIVE WORKFLOWS (8)

### 1. Lead Discovery Pipeline
- Trigger: Daily cron 6am + manual
- Steps: Search → Deduplicate → Score → Store → Notify
- SLA: ≥50 new leads/day
- Output: leads in xps_companies table

### 2. Outreach Sequence
- Trigger: Daily cron 9am weekdays
- Steps: Get leads → Generate pitch → Send → Log → Schedule follow-up
- Multi-touch: Initial → Day 3 follow-up → Day 7 close
- Output: outreach logged in call_logs

### 3. Daily Morning Briefing
- Trigger: 8am daily
- Steps: Pull stats → Generate AI summary → Send WhatsApp
- Format: Pipeline count, hot leads, action items, revenue estimate
- Recipient: Jeremy Bensen WhatsApp

### 4. Benchmark & Self-Heal
- Trigger: 3am nightly
- Steps: Benchmark → Validate → Detect gaps → Fix → Push → Alert
- Target: ≥95% score maintained

### 5. Weekly Intelligence Report
- Trigger: Monday 8am
- Steps: Market research → Competitor analysis → Pipeline review → Report → Send
- Output: Comprehensive market intelligence + action plan

### 6. Inbound Lead Auto-Response
- Trigger: Webhook (WhatsApp inbound)
- Steps: Classify → Check CRM → Respond → Update CRM → Notify Jeremy
- SLA: Response within 60 seconds

### 7. Proposal Generator
- Trigger: Manual (on demand)
- Steps: Load lead → Research → Write proposal → Format → Share link
- Output: Branded PDF/HTML proposal

### 8. Capability Auto-Installer
- Trigger: 2am nightly
- Steps: Check capabilities → Find degraded → Reinstall → Verify
- Target: 30/30 capabilities active

## PLANNED WORKFLOWS (Phase 2)
- WF-09: Contract Generation + E-signature
- WF-10: Invoice + Payment tracking
- WF-11: Project status automation
- WF-12: Referral partner outreach
- WF-13: Social media content pipeline
- WF-14: Google Drive document sync
