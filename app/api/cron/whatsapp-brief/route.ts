/**
 * CRON: Daily WhatsApp Lead Brief
 * Discovers leads, scores them, sends top 5 to owner via WhatsApp
 * Schedule: Every weekday at 8:00 AM ET (13:00 UTC) via vercel.json
 */
import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/ai";

export const dynamic    = "force-dynamic";
export const maxDuration = 55;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const base  = req.headers.get("x-forwarded-host")
    ? `https://${req.headers.get("x-forwarded-host")}`
    : "https://agent-zero-pspyutj5b-strategic-minds-advisory.vercel.app";

  try {
    // 1. Discover leads
    const scrapeResp = await fetch(`${base}/api/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "concrete epoxy flooring contractor Arizona" }),
      signal: AbortSignal.timeout(20000),
    });
    const scrapeData = await scrapeResp.json() as { leads?: Array<{company:string;city?:string;phone?:string;snippet?:string;score?:number;pitch_opener?:string}> };
    const leads = scrapeData.leads || [];

    // 2. Score leads via score-batch
    const scoreResp = await fetch(`${base}/api/score-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companies: leads.map(l => ({ name: l.company, city: l.city, notes: l.snippet })) }),
      signal: AbortSignal.timeout(30000),
    });
    const scoreData = await scoreResp.json() as { companies?: Array<{name:string;lead_score:number;priority_tier:string;pitch_angle:string;next_action:string}> };
    const scored = scoreData.companies || [];

    // 3. Merge score data back into leads
    const enriched = leads.map(l => {
      const s = scored.find(sc => sc.name === l.company);
      return {
        company: l.company,
        city: l.city || "Arizona",
        phone: l.phone || "",
        score: s?.lead_score || l.score || 70,
        priority_tier: s?.priority_tier || "B",
        pitch_opener: s?.pitch_angle || l.pitch_opener || "",
      };
    }).sort((a,b) => b.score - a.score);

    // 4. Send WhatsApp brief
    const waResp = await fetch(`${base}/api/whatsapp-outreach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leads: enriched.slice(0,5), mode: "brief" }),
      signal: AbortSignal.timeout(15000),
    });
    const waData = await waResp.json() as { ok: boolean; error?: string };

    return NextResponse.json({
      ok: true,
      leads_discovered: leads.length,
      leads_scored: scored.length,
      whatsapp_sent: waData.ok,
      whatsapp_error: waData.error,
      top_lead: enriched[0]?.company || "none",
      latency_ms: Date.now() - start,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0,200), latency_ms: Date.now()-start }, { status: 500 });
  }
}
