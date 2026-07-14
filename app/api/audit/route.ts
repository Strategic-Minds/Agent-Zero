import { NextRequest, NextResponse } from "next/server";
import { runIndependentAudit, type AuditConfig } from "@/lib/audit-engine";
import { remember } from "@/lib/memory";
import { getSupabaseAdmin } from "@/lib/supabase";
import { classifyAction, logAction } from "@/lib/governance";

// AGENT-ZERO — /api/audit
// Receives discovery jobs from BUSINESS-BUILDER pipeline
// Runs 12-dimension FAANG audit + scores + writes memory
// Triggers SM QA Agent for frontend/backend testing
// Returns scored report for AUTO_BUILDER to fix

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SHARED_SECRET = process.env.APEX_SHARED_SECRET ?? "";
const SM_QA_URL = process.env.SM_QA_AGENT_URL ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

async function sbUpdate(table: string, match: Record<string,string>, data: Record<string,unknown>) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  const params = Object.entries(match).map(([k,v])=>`${k}=eq.${encodeURIComponent(v)}`).join("&");
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: "PATCH",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
               "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(data),
  });
}

async function triggerQA(targetUrl: string, projectName: string, auditReport: Record<string,unknown>) {
  if (!SM_QA_URL) return { triggered: false, reason: "SM_QA_AGENT_URL not set" };
  try {
    const res = await fetch(`${SM_QA_URL}/api/run-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        site_url: targetUrl,
        project_name: projectName,
        persona_id: "homeowner",
        source: "agent_zero_pipeline",
        audit_context: {
          score: auditReport.overall_score,
          top_gaps: auditReport.top_gaps,
          triggered_by: "agent_zero",
        },
      }),
      signal: AbortSignal.timeout(10000),
    });
    return { triggered: res.ok, status: res.status };
  } catch(e) { return { triggered: false, error: String(e) }; }
}

export async function POST(req: NextRequest) {
  // Auth
  const token = req.headers.get("x-apex-token") ?? "";
  if (SHARED_SECRET && token !== SHARED_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: {
    target_url: string; target_name: string; target_type: string;
    discovery_id?: string; strict_threshold?: number; next_step?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { target_url, target_name, target_type, discovery_id, strict_threshold = 85 } = body;
  if (!target_url) return NextResponse.json({ ok: false, error: "target_url required" }, { status: 422 });

  const startedAt = Date.now();

  // Update pipeline status
  if (discovery_id) {
    await sbUpdate("pipeline_discovery_queue", { discovery_id },
      { status: "analyzing", stage: "agent_zero_audit", started_at: new Date().toISOString() });
  }

  // Run 12-dimension FAANG audit
  let auditReport: Record<string, unknown> = {};
  let overallScore = 0;
  try {
    const config: AuditConfig = {
      targetUrl: target_url,
      targetName: target_name,
      targetType: (target_type as AuditConfig["targetType"]) ?? "external",
      auditId: discovery_id ?? `AUDIT-${Date.now()}`,
      strictMode: true,
      scoreThreshold: strict_threshold,
    };
    const result = await runIndependentAudit(config);
    auditReport = result as Record<string, unknown>;
    overallScore = (result as { overall_score?: number }).overall_score ?? 0;
  } catch(e) {
    auditReport = { error: String(e), overall_score: 0 };
  }

  const passed = overallScore >= strict_threshold;
  const durationMs = Date.now() - startedAt;

  // Write to agent memory
  await remember({
    agent_id: "agent_zero",
    memory_type: "episodic",
    key: `audit:${target_url}:${new Date().toISOString().slice(0,10)}`,
    value: { target_url, target_name, score: overallScore, passed, gaps: (auditReport as {top_gaps?: string[]}).top_gaps ?? [] },
    importance: passed ? 5 : 8,
    tags: ["audit", target_type, passed ? "passed" : "failed"],
  }).catch(() => null);

  // Write to Supabase pipeline
  const db = getSupabaseAdmin();
  await db.from("pipeline_audit_results").insert({
    discovery_id: discovery_id ?? null,
    target_url, target_name, target_type,
    overall_score: overallScore,
    passed,
    strict_threshold,
    audit_report: auditReport,
    duration_ms: durationMs,
    created_at: new Date().toISOString(),
  }).catch(() => null);

  // Trigger SM QA Agent (next pipeline stage)
  const qaResult = passed
    ? await triggerQA(target_url, target_name, auditReport)
    : { triggered: false, reason: `Score ${overallScore} below threshold ${strict_threshold}` };

  // Update pipeline record
  if (discovery_id) {
    await sbUpdate("pipeline_discovery_queue", { discovery_id }, {
      status: passed ? "qa_testing" : "blocked_low_score",
      stage: passed ? "sm_qa_agent" : "blocked",
      analysis_score: overallScore,
      updated_at: new Date().toISOString(),
    });
  }

  await logAction(`audit:${target_url}`, passed ? 1 : 2);

  return NextResponse.json({
    ok: true,
    discovery_id,
    target_url,
    overall_score: overallScore,
    passed,
    strict_threshold,
    pipeline_continued: qaResult.triggered,
    qa_agent: qaResult,
    duration_ms: durationMs,
    top_gaps: (auditReport as {top_gaps?: string[]}).top_gaps ?? [],
    next: passed ? "sm_qa_agent_running" : "blocked — score below threshold, auto_builder will fix",
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "agent-zero/api/audit", mode: "unified_pipeline" });
}
