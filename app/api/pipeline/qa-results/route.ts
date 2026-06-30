import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { remember } from "@/lib/memory";

// AGENT-ZERO — /api/pipeline/qa-results
// Receives QA test results from SM QA Agent
// Decides: pass → mark done | fail → trigger AUTO_BUILDER fix

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const AUTO_BUILDER_URL = process.env.AUTO_BUILDER_URL ?? "";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function POST(req: NextRequest) {
  let body: {
    discovery_id?: string; target_url: string; project_name: string;
    score: number; grade: string; issues: Array<{severity: string; title: string; auto_fixable: boolean}>;
    steps_passed: number; steps_failed: number; duration_ms: number;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const passed = body.score >= 75 && body.steps_failed === 0;
  const criticalIssues = body.issues?.filter(i => i.severity === "critical") ?? [];
  const autoFixableIssues = body.issues?.filter(i => i.auto_fixable) ?? [];

  // Write QA result to Supabase
  await db.from("pipeline_qa_results").insert({
    discovery_id: body.discovery_id ?? null,
    target_url: body.target_url,
    project_name: body.project_name,
    score: body.score,
    grade: body.grade,
    passed,
    critical_issues: criticalIssues.length,
    auto_fixable_issues: autoFixableIssues.length,
    issues: body.issues,
    steps_passed: body.steps_passed,
    steps_failed: body.steps_failed,
    duration_ms: body.duration_ms,
    created_at: new Date().toISOString(),
  }).catch(() => null);

  // Write to memory
  await remember({ agent_id: "agent_zero", memory_type: "episodic",
    key: `qa:${body.target_url}:${new Date().toISOString().slice(0,10)}`,
    value: { score: body.score, grade: body.grade, passed, critical: criticalIssues.length, auto_fixable: autoFixableIssues.length },
    importance: passed ? 4 : 8, tags: ["qa", passed ? "passed" : "failed", body.grade] });

  // Update pipeline queue status
  if (body.discovery_id) {
    await db.from("pipeline_discovery_queue").update({
      status: passed ? "completed" : "qa_failed",
      stage: passed ? "done" : "auto_fix",
      qa_score: body.score,
      updated_at: new Date().toISOString(),
    }).eq("discovery_id", body.discovery_id).catch(() => null);
  }

  // Trigger AUTO_BUILDER fix if QA failed and there are auto-fixable issues
  let fixTriggered = false;
  if (!passed && autoFixableIssues.length > 0 && AUTO_BUILDER_URL) {
    try {
      const res = await fetch(`${AUTO_BUILDER_URL}/api/cron/auto-builder`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${CRON_SECRET}` },
        body: JSON.stringify({
          trigger: "qa_failure",
          discovery_id: body.discovery_id,
          target_url: body.target_url,
          issues: autoFixableIssues,
          qa_score: body.score,
        }),
        signal: AbortSignal.timeout(8000),
      });
      fixTriggered = res.ok;
    } catch(e) { /* non-blocking */ }
  }

  return NextResponse.json({
    ok: true,
    qa_score: body.score,
    passed,
    critical_issues: criticalIssues.length,
    auto_fixable: autoFixableIssues.length,
    fix_triggered: fixTriggered,
    next: passed ? "pipeline_complete" : fixTriggered ? "auto_builder_fixing" : "manual_review_needed",
  });
}
