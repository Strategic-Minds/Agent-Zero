/**
 * DAILY BENCHMARK CRON — runs at 06:00 UTC
 * Runs full 40-test suite, saves results, triggers APEX self-improvement if score < 95%
 */
import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  const secret = process.env.CRON_SECRET || process.env.BRIDGE_SECRET
  if (!auth?.includes(secret || "")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const BASE = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"

  try {
    // 1. Run full benchmark
    const benchRes = await fetch(`${BASE}/api/benchmark`, { signal: AbortSignal.timeout(280000) })
    const report = await benchRes.json() as {
      run_id: string; overall_score: number; tier: string; passed: number; failed: number; total: number;
      improvement_targets: string[]; deployable: boolean; category_scores: Record<string,number>
    }

    const { overall_score, tier, passed, failed, total, improvement_targets, deployable } = report

    // 2. Save run to benchmark history
    const db = getSupabaseAdmin()
    await db.from("benchmark_runs").upsert({
      run_id: report.run_id,
      score: overall_score,
      tier,
      passed,
      failed,
      total,
      deployable,
      triggered_by: "cron",
      created_at: new Date().toISOString(),
    }, { onConflict: "run_id" })

    // 3. Save to agent memory
    await db.from("agent_memory").upsert({
      agent_id: "agent-zero",
      key: "last_benchmark_score",
      value: { score: overall_score, tier, passed, failed, total, date: new Date().toISOString() },
      memory_type: "semantic",
      importance: 9,
      updated_at: new Date().toISOString(),
    }, { onConflict: "agent_id,key" })

    // 4. If score < 95%, trigger APEX self-improvement
    let apexResult = null
    if (overall_score < 95 && improvement_targets.length > 0) {
      try {
        const apexRes = await fetch(`${BASE}/api/apex`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${secret}` },
          body: JSON.stringify({
            task: "self_improvement",
            benchmark_score: overall_score,
            failing_tests: improvement_targets,
            instruction: `Benchmark score is ${overall_score}% (${tier}). Target is 95%+. Analyze failing tests and suggest/implement fixes to reach S-Tier. Failing: ${improvement_targets.slice(0,3).join(" | ")}`,
          }),
          signal: AbortSignal.timeout(120000),
        })
        apexResult = await apexRes.json()
      } catch (e) {
        apexResult = { error: String(e).slice(0,100) }
      }
    }

    // 5. WhatsApp notification to Jeremy
    const ownerPhone = process.env.OWNER_WHATSAPP
    const waToken = process.env.WHATSAPP_BUSINESS_TOKEN
    const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
    if (ownerPhone && waToken && waPhoneId) {
      const emoji = overall_score >= 95 ? "🏆" : overall_score >= 85 ? "✅" : overall_score >= 70 ? "⚡" : "🔴"
      const msg = `${emoji} *AGENT ZERO DAILY BENCHMARK*\n\nScore: ${overall_score}% (${tier})\nTests: ${passed}/${total} passed\nStatus: ${deployable ? "DEPLOYABLE ✅" : "NEEDS WORK ⚠️"}${improvement_targets.length > 0 ? "\n\nTop fixes needed:\n" + improvement_targets.slice(0,2).map((t,i)=>`${i+1}. ${t.slice(0,60)}`).join("\n") : "\n\nAll systems optimal! 🚀"}\n\n_${new Date().toLocaleString()}_`
      await fetch(`https://graph.facebook.com/v20.0/${waPhoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${waToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: ownerPhone.replace(/\D/g,""), type: "text", text: { body: msg } }),
      })
    }

    return NextResponse.json({
      success: true,
      benchmark: { score: overall_score, tier, passed, failed, total, deployable },
      self_improvement_triggered: overall_score < 95,
      apex_result: apexResult,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0,300) }, { status: 500 })
  }
}
