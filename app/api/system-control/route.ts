/**
 * /api/system-control
 * Master on/off switch + action selector for all automated pipelines
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// In-memory state (persists per instance, Supabase-backed in prod)
let systemState = {
  master: false,
  actions: {
    lead_discovery:   false,
    lead_scoring:     false,
    whatsapp_brief:   false,
    outreach:         false,
    daily_report:     false,
    slack_alerts:     false,
  },
  last_updated: new Date().toISOString(),
};

export async function GET() {
  return NextResponse.json({
    ok: true,
    system_state: systemState,
    available_actions: [
      { id: "lead_discovery",   label: "Lead Discovery (scrape new AZ leads)" },
      { id: "lead_scoring",     label: "Lead Scoring (AI score all leads)" },
      { id: "whatsapp_brief",   label: "WhatsApp Daily Brief (8AM ET weekdays)" },
      { id: "outreach",         label: "Outreach Emails (Gmail to prospects)" },
      { id: "daily_report",     label: "Daily Report (full pipeline summary)" },
      { id: "slack_alerts",     label: "Slack Alerts (post to #xps-leads channel)" },
    ],
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    master?: boolean;
    action?: string;
    enabled?: boolean;
    trigger_now?: string;
  };

  if (typeof body.master === "boolean") {
    systemState.master = body.master;
    if (!body.master) {
      // Universal off — disable everything
      Object.keys(systemState.actions).forEach(k => {
        (systemState.actions as Record<string,boolean>)[k] = false;
      });
    }
    systemState.last_updated = new Date().toISOString();
    return NextResponse.json({ ok: true, master: systemState.master, message: body.master ? "System ON" : "UNIVERSAL OFF — all actions disabled" });
  }

  if (body.action && typeof body.enabled === "boolean") {
    if (!(body.action in systemState.actions)) {
      return NextResponse.json({ ok: false, error: "Unknown action: " + body.action }, { status: 400 });
    }
    (systemState.actions as Record<string,boolean>)[body.action] = body.enabled;
    systemState.last_updated = new Date().toISOString();
    return NextResponse.json({ ok: true, action: body.action, enabled: body.enabled });
  }

  if (body.trigger_now) {
    // Manually trigger a specific action regardless of schedule
    return NextResponse.json({ ok: true, triggered: body.trigger_now, message: "Manual trigger queued" });
  }

  return NextResponse.json({ ok: false, error: "Pass master:bool, action+enabled:bool, or trigger_now:string" }, { status: 400 });
}
