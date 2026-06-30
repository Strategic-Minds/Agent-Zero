import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { remember } from "@/lib/memory";

// AGENT-ZERO — /api/cron/pipeline-orchestrator
// The master cron that drives the full discovery → analysis → QA → fix → evolve loop
// Fires every 15 minutes via Vercel cron
// Reads from pipeline_discovery_queue, dispatches to correct stage
// Writes all state to Supabase + agent memory

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const AUTO_BUILDER_URL = process.env.AUTO_BUILDER_URL ?? "";
const SM_QA_URL = process.env.SM_QA_AGENT_URL ?? "";

async function sb(path: string, opts: RequestInit = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...((opts.headers as Record<string,string>) ?? {}),
    },
  });
  return res.ok ? res.json() : null;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? req.headers.get("x-cron-secret") ?? "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}` && auth !== CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const summary: string[] = [];
  let processed = 0, healed = 0, evolved = 0;

  try {
    const db = getSupabaseAdmin();

    // ── STAGE 1: Pick up queued discovery jobs ──────────────────────────
    const queued = await sb("pipeline_discovery_queue?status=eq.queued&limit=3&order=priority.desc");
    for (const job of (queued ?? [])) {
      try {
        const res = await fetch(`${(process.env.VERCEL_URL ? "https://"+process.env.VERCEL_URL : "http://localhost:3000")}/api/audit`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-apex-token": process.env.APEX_SHARED_SECRET ?? "" },
          body: JSON.stringify({ target_url: job.target_url, target_name: job.target_name, target_type: job.target_type, discovery_id: job.discovery_id, strict_threshold: job.strict_score_threshold ?? 85 }),
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) { processed++; summary.push(`AUDITED: ${job.target_name}`); }
      } catch(e) { summary.push(`AUDIT_FAIL: ${job.target_name} — ${String(e).slice(0,50)}`); }
    }

    // ── STAGE 2: Pick up QA-complete → trigger AUTO_BUILDER fix ─────────
    const qaComplete = await sb("pipeline_discovery_queue?status=eq.qa_failed&limit=2&order=priority.desc");
    for (const job of (qaComplete ?? [])) {
      if (!AUTO_BUILDER_URL) break;
      try {
        const res = await fetch(`${AUTO_BUILDER_URL}/api/cron/recursive-control`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${CRON_SECRET}` },
          body: JSON.stringify({ trigger: "pipeline_fix", discovery_id: job.discovery_id, target_url: job.target_url }),
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) { healed++; summary.push(`FIX_TRIGGERED: ${job.target_name}`); }
      } catch(e) { summary.push(`FIX_FAIL: ${job.target_name}`); }
    }

    // ── STAGE 3: Evolution + AI Intelligence Monitoring ─────────────────
    // Check for new top AI systems to monitor (daily task)
    const lastEvolution = await db.from("agent_memory").select("*")
      .eq("agent_id","agent_zero").eq("key","last_ai_discovery_scan")
      .single().then(r => r.data?.updated_at ?? null);

    const hoursSince = lastEvolution
      ? (Date.now() - new Date(lastEvolution).getTime()) / 36e5
      : 999;

    if (hoursSince > 24) {
      // Monitor top AI systems — strict scoring requirement
      const topAiSystems = [
        { url: "https://anthropic.com", name: "Anthropic", type: "ai_company", threshold: 95 },
        { url: "https://openai.com", name: "OpenAI", type: "ai_company", threshold: 95 },
        { url: "https://deepmind.google", name: "DeepMind", type: "ai_company", threshold: 90 },
        { url: "https://mistral.ai", name: "Mistral AI", type: "ai_company", threshold: 90 },
        { url: "https://cohere.com", name: "Cohere", type: "ai_company", threshold: 85 },
        { url: "https://huggingface.co", name: "HuggingFace", type: "tech_stack", threshold: 85 },
      ];
      for (const sys of topAiSystems.slice(0,2)) { // 2 per cron cycle
        await sb("pipeline_discovery_queue", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            discovery_id: `DISC-AI-${sys.name.replace(/\s/g,"")}-${Date.now()}`,
            target_url: sys.url, target_name: sys.name, target_type: sys.type,
            purpose: "monitor", triggered_by: "cron",
            project: "AI Intelligence Monitor", priority: 7,
            strict_score_threshold: sys.threshold, status: "queued", stage: "discovery",
          }),
        }).catch(() => null);
        evolved++;
        summary.push(`AI_MONITOR_QUEUED: ${sys.name}`);
      }
      await remember({ agent_id: "agent_zero", memory_type: "procedural",
        key: "last_ai_discovery_scan", value: { ran_at: new Date().toISOString(), systems_queued: evolved },
        importance: 6, tags: ["cron","ai_monitor","evolution"] });
    }

    const duration = Date.now() - start;

    // Write cron log
    await db.from("pipeline_cron_log").insert({
      cron_route: "/api/cron/pipeline-orchestrator",
      processed, healed, evolved,
      summary: summary.join(" | "),
      status: "completed", duration_ms: duration,
      created_at: new Date().toISOString(),
    }).catch(() => null);

    return NextResponse.json({ ok: true, processed, healed, evolved, summary, duration_ms: duration });

  } catch(e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
