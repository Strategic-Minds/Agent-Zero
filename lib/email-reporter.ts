/**
 * EMAIL REPORTER — lib/email-reporter.ts
 * Sends beautiful HTML reports to strategicmindsadvisory@gmail.com
 * Uses Resend (free tier: 3000 emails/month)
 * Reports: SOP summary, audit results, self-reflection, evolution cycles
 */

export interface EmailReport {
  subject: string
  to: string
  body_html: string
  body_text: string
}

export function buildSOPEmailHTML(summary: {
  narrative: string
  total_events: number
  successful_events: number
  failed_events: number
  system_health_trend: string
  key_outcomes: string[]
  anomalies: string[]
  top_agents: Array<{ agent: string; count: number; success_rate: number }>
  period_start: string
  period_end: string
}, auditScore?: number): string {
  const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
  const successRate = summary.total_events > 0
    ? Math.round((summary.successful_events / summary.total_events) * 100)
    : 100
  const healthColor = summary.system_health_trend === "improving" ? "#22c55e"
    : summary.system_health_trend === "stable" ? "#f59e0b" : "#ef4444"
  const scoreColor = (auditScore || 0) >= 90 ? "#22c55e" : (auditScore || 0) >= 75 ? "#f59e0b" : "#ef4444"

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Agent Zero Report</title></head>
<body style="margin:0;padding:0;background:#000;font-family:system-ui,-apple-system,sans-serif;color:#fff;">
<div style="max-width:640px;margin:0 auto;padding:32px 24px;">

  <div style="border-bottom:1px solid #1a1a1a;padding-bottom:24px;margin-bottom:24px;">
    <div style="color:#333;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Strategic Minds Advisory</div>
    <h1 style="margin:0;font-size:24px;font-weight:900;">Agent Zero — 4-Hour Report</h1>
    <div style="color:#555;font-size:12px;margin-top:6px;">${now} (Eastern)</div>
  </div>

  <!-- Health Status -->
  <div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:12px;padding:20px;margin-bottom:20px;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:28px;font-weight:900;color:${healthColor};">${summary.system_health_trend.toUpperCase()}</div>
        <div style="color:#555;font-size:11px;text-transform:uppercase;">System Health Trend</div>
      </div>
      ${auditScore ? `<div style="text-align:right;"><div style="font-size:28px;font-weight:900;color:${scoreColor};">${auditScore}/100</div><div style="color:#555;font-size:11px;text-transform:uppercase;">Audit Score</div></div>` : ''}
    </div>
  </div>

  <!-- Stats Row -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">
    <div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:10px;padding:14px;text-align:center;">
      <div style="font-size:24px;font-weight:900;color:#fff;">${summary.total_events}</div>
      <div style="color:#444;font-size:10px;text-transform:uppercase;">Total Actions</div>
    </div>
    <div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:10px;padding:14px;text-align:center;">
      <div style="font-size:24px;font-weight:900;color:#22c55e;">${successRate}%</div>
      <div style="color:#444;font-size:10px;text-transform:uppercase;">Success Rate</div>
    </div>
    <div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:10px;padding:14px;text-align:center;">
      <div style="font-size:24px;font-weight:900;color:${summary.failed_events > 0 ? '#ef4444' : '#22c55e'};">${summary.failed_events}</div>
      <div style="color:#444;font-size:10px;text-transform:uppercase;">Errors</div>
    </div>
  </div>

  <!-- Narrative -->
  <div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:12px;padding:20px;margin-bottom:20px;">
    <div style="color:#333;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">System Narrative</div>
    <p style="margin:0;color:#ccc;font-size:13px;line-height:1.7;">${summary.narrative}</p>
  </div>

  <!-- Key Outcomes -->
  <div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:12px;padding:20px;margin-bottom:20px;">
    <div style="color:#333;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Key Outcomes</div>
    ${summary.key_outcomes.map(o => `<div style="color:#ddd;font-size:12px;padding:4px 0;border-bottom:1px solid #111;">✅ ${o}</div>`).join('')}
  </div>

  ${summary.anomalies.length > 0 ? `
  <div style="background:#1a0d0d;border:1px solid #991b1b;border-radius:12px;padding:20px;margin-bottom:20px;">
    <div style="color:#ef4444;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">⚠️ Anomalies Detected</div>
    ${summary.anomalies.map(a => `<div style="color:#fca5a5;font-size:12px;padding:4px 0;">• ${a}</div>`).join('')}
  </div>
  ` : ''}

  <!-- Top Agents -->
  <div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:12px;padding:20px;margin-bottom:20px;">
    <div style="color:#333;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Most Active Agents</div>
    ${summary.top_agents.map(a => `
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #111;font-size:12px;">
        <span style="color:#ddd;">${a.agent}</span>
        <span style="color:#555;">${a.count} actions · ${a.success_rate}% success</span>
      </div>
    `).join('')}
  </div>

  <div style="text-align:center;padding-top:24px;border-top:1px solid #1a1a1a;color:#333;font-size:11px;">
    Agent Zero Autonomous Intelligence System<br>
    Strategic Minds Advisory · XPS Intelligence<br>
    <a href="https://agent-zero-j42y0tiih-strategic-minds-advisory.vercel.app" style="color:#555;">View Dashboard</a>
  </div>
</div>
</body>
</html>`
}

export async function sendEmail(report: EmailReport): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log("[EMAIL] No RESEND_API_KEY — skipping email send")
    return { success: false, error: "No RESEND_API_KEY configured" }
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Agent Zero <agent@agentzerosystem.com>",
        to: [report.to],
        subject: report.subject,
        html: report.body_html,
        text: report.body_text,
      }),
    })
    const data = await res.json() as Record<string, unknown>
    return res.ok ? { success: true } : { success: false, error: JSON.stringify(data) }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}
