import { NextResponse } from "next/server"
import { runCapabilityBenchmark, getLatestBenchmarkRun } from "@/lib/benchmark-engine"
import { getCapabilityStats } from "@/lib/capabilities"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret") || req.headers.get("authorization")?.replace("Bearer ","")
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  console.log("[CRON] Nightly benchmark starting...")
  const results = await runCapabilityBenchmark()
  const stats = getCapabilityStats()
  const avgScore = Math.round(results.reduce((a, r) => a + r.score, 0) / results.length)
  const avgTarget = Math.round(results.reduce((a, r) => a + r.target, 0) / results.length)
  const gpa = ((avgScore / avgTarget) * 4.0).toFixed(2)

  // Notify owner via WhatsApp if score drops significantly
  const prev = await getLatestBenchmarkRun()
  if (prev && prev.avg_score && avgScore < prev.avg_score - 5) {
    try {
      const ownerPhone = process.env.OWNER_WHATSAPP
      if (ownerPhone) {
        await fetch(`${process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000"}/api/whatsapp/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: ownerPhone, message: `⚠️ Agent Zero benchmark score dropped: ${prev.avg_score}% → ${avgScore}% (GPA: ${gpa})` }),
        })
      }
    } catch { /* non-blocking */ }
  }

  console.log(`[CRON] Benchmark complete — Score: ${avgScore}% | GPA: ${gpa}`)
  return NextResponse.json({ capabilities_tested: results.length, avg_score: avgScore, avg_target: avgTarget, gpa, stats })
}
