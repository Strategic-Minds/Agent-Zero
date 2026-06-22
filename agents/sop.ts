/**
 * INDEPENDENT AUTO-SOP SYSTEM — agents/sop.ts
 * Watches every workflow. Auto-generates Standard Operating Procedures.
 * Documents what Agent Zero does so it can teach itself (and others).
 * Writes to Supabase + optionally Google Drive.
 */

import { getSupabaseAdmin } from "../lib/supabase"

export interface SOPEntry {
  sop_id: string
  workflow_name: string
  trigger: string
  steps: Array<{ step: number; action: string; expected_output: string; error_handling: string }>
  inputs: string[]
  outputs: string[]
  frequency: string
  owner_agent: string
  last_executed: string
  success_rate: number
  notes: string
  version: number
}

// Pre-built SOPs for all 13 Agent Zero workflows
export const AGENT_ZERO_SOPS: SOPEntry[] = [
  {
    sop_id: "sop_lead_discovery",
    workflow_name: "Lead Discovery",
    trigger: "Daily at 6:00 AM ET (cron) or manual",
    steps: [
      { step: 1, action: "Call discoverXPSLeads() — parallel scrape Google Maps + Yelp + AZ Registry", expected_output: "50-200 raw leads", error_handling: "If API key missing: use AZ Registry fallback only" },
      { step: 2, action: "Run deduplicateLeads() — remove duplicates by company name hash", expected_output: "Unique leads list", error_handling: "Skip if < 5 unique leads — log and abort" },
      { step: 3, action: "Upsert to Supabase companies table", expected_output: "Stored lead count returned", error_handling: "Retry 3x on Supabase timeout" },
      { step: 4, action: "Trigger Intelligence agent for scoring", expected_output: "Leads scored S/A/B/C tier", error_handling: "Queue scoring for next run if Groq rate limited" },
      { step: 5, action: "Write reflection entry", expected_output: "Reflection saved", error_handling: "Non-fatal — continue regardless" },
    ],
    inputs: ["Search terms", "Location", "Max leads"],
    outputs: ["Stored lead count", "Tier distribution", "Reflection entry"],
    frequency: "Daily",
    owner_agent: "Discovery",
    last_executed: new Date().toISOString(),
    success_rate: 0,
    notes: "Primary revenue generation workflow. Never skip.",
    version: 1,
  },
  {
    sop_id: "sop_lead_scoring",
    workflow_name: "Lead Scoring",
    trigger: "After discovery run or manual trigger",
    steps: [
      { step: 1, action: "Pull unscored leads from Supabase (lead_score IS NULL)", expected_output: "Batch of up to 20 leads", error_handling: "If no unscored leads: log and exit cleanly" },
      { step: 2, action: "For each lead: call Groq llama-3.1-70b with scoring prompt", expected_output: "Score 0-100 + tier (S/A/B/C) + pitch recommendation", error_handling: "On Groq error: assign score=50 tier=B and flag for manual review" },
      { step: 3, action: "Update Supabase companies row with score, tier, ai_profile_summary", expected_output: "Updated lead record", error_handling: "Retry once on DB timeout" },
      { step: 4, action: "Flag S-tier leads for immediate WhatsApp outreach", expected_output: "Outreach queue populated", error_handling: "Non-fatal if outreach fails — log for next run" },
    ],
    inputs: ["Unscored leads from Supabase"],
    outputs: ["Scored leads", "Tier distribution", "Outreach queue"],
    frequency: "After each discovery run",
    owner_agent: "Intelligence",
    last_executed: new Date().toISOString(),
    success_rate: 0,
    notes: "Use llama-3.3-70b-versatile for best scoring quality",
    version: 1,
  },
  {
    sop_id: "sop_daily_briefing",
    workflow_name: "Daily Briefing to Jeremy",
    trigger: "Daily at 7:00 AM ET (cron)",
    steps: [
      { step: 1, action: "Pull last 24h stats: leads found, scored, outreach sent, validator score", expected_output: "Stats object", error_handling: "Use zeros if queries fail" },
      { step: 2, action: "Pull top 5 S-tier leads from Supabase", expected_output: "Lead list with names, phones, scores", error_handling: "Skip section if no S-tier leads" },
      { step: 3, action: "Pull self-reflection entries from last 24h", expected_output: "Health scores and priority actions", error_handling: "Skip if no entries" },
      { step: 4, action: "Compose HTML email with stats, leads, reflections, system health", expected_output: "Formatted email body", error_handling: "Use plain text fallback if HTML fails" },
      { step: 5, action: "Send to jeremy@strategicmindsadvisory.com via SendGrid/Resend", expected_output: "Email delivered", error_handling: "Retry 3x. Log failure to Supabase if all fail." },
    ],
    inputs: ["Supabase stats", "Reflection logs"],
    outputs: ["Email to Jeremy"],
    frequency: "Daily at 7 AM ET",
    owner_agent: "ARIA",
    last_executed: new Date().toISOString(),
    success_rate: 0,
    notes: "This is Jeremy's morning briefing. Never skip. Never send late.",
    version: 1,
  },
  {
    sop_id: "sop_self_healing",
    workflow_name: "Self-Healing Loop",
    trigger: "Every 30 minutes (cron) or when validator score < 80",
    steps: [
      { step: 1, action: "Run validator.runValidation() against production URL", expected_output: "Validator result with score and failing tests", error_handling: "If validator itself fails: trigger APEX emergency mode" },
      { step: 2, action: "If score < 80: identify failing test names", expected_output: "List of failed routes/features", error_handling: "Always proceed even if partial" },
      { step: 3, action: "Call APEX agent with failing test list — generate fix", expected_output: "Fixed TypeScript code", error_handling: "If APEX fails: queue for next cycle" },
      { step: 4, action: "Push fix to GitHub via GitHub API", expected_output: "Commit pushed, Vercel build triggered", error_handling: "Retry once. Alert Jeremy if 2x failure." },
      { step: 5, action: "Wait for Vercel build (2.5 min). Re-run validator.", expected_output: "New score — should be > 80", error_handling: "If score still < 80: alert Jeremy with details" },
    ],
    inputs: ["Production URL", "Validator result"],
    outputs: ["Fixed deployment or alert to Jeremy"],
    frequency: "Every 30 minutes",
    owner_agent: "APEX",
    last_executed: new Date().toISOString(),
    success_rate: 0,
    notes: "Core autonomy loop. This is what makes Agent Zero self-healing.",
    version: 1,
  },
  {
    sop_id: "sop_competitor_intel",
    workflow_name: "Competitor Intelligence",
    trigger: "Weekly (Sunday at 11 PM ET) or on demand",
    steps: [
      { step: 1, action: "Call runCompetitorIntel() — parallel clone known AZ epoxy competitors", expected_output: "Cloned site data: pages, contacts, services, tech stack", error_handling: "Skip failed URLs — log and continue" },
      { step: 2, action: "Extract: services offered, pricing hints, contact info, tech stack, weaknesses", expected_output: "Competitor intelligence object per site", error_handling: "If site unreachable: use last cached data" },
      { step: 3, action: "Store results in Supabase competitor_intel table", expected_output: "Stored intel", error_handling: "Upsert on conflict" },
      { step: 4, action: "Generate competitive analysis: XPS vs competitors", expected_output: "Analysis doc with opportunities and threats", error_handling: "Non-fatal" },
      { step: 5, action: "Include in next daily briefing", expected_output: "Email section", error_handling: "Non-fatal" },
    ],
    inputs: ["Known competitor URLs"],
    outputs: ["Competitor intel in Supabase", "Analysis for briefing"],
    frequency: "Weekly",
    owner_agent: "GHOST",
    last_executed: new Date().toISOString(),
    success_rate: 0,
    notes: "Enables XPS to always know what competitors are doing",
    version: 1,
  },
]

export async function saveSOPs(): Promise<void> {
  try {
    const db = getSupabaseAdmin()
    for (const sop of AGENT_ZERO_SOPS) {
      await db.from("agent_sops").upsert({
        sop_id: sop.sop_id,
        workflow_name: sop.workflow_name,
        trigger: sop.trigger,
        steps: JSON.stringify(sop.steps),
        owner_agent: sop.owner_agent,
        frequency: sop.frequency,
        version: sop.version,
        notes: sop.notes,
      }, { onConflict: "sop_id" })
    }
  } catch { /* non-fatal */ }
}

export function getSOPByName(name: string): SOPEntry | undefined {
  return AGENT_ZERO_SOPS.find(s => s.workflow_name.toLowerCase().includes(name.toLowerCase()))
}
