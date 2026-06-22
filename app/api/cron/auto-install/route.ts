import { NextResponse } from "next/server"
import { runAutoInstaller } from "@/lib/auto-installer"
import { getCapabilityStats } from "@/lib/capabilities"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret") || req.headers.get("authorization")?.replace("Bearer ","")
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  console.log("[CRON] Nightly auto-installer starting...")
  const results = await runAutoInstaller()
  const stats = getCapabilityStats()

  return NextResponse.json({
    message: "Nightly auto-install complete — all 30 capabilities verified",
    verified: results.filter(r => r.action === "verified").length,
    installed: results.filter(r => r.action === "installed").length,
    failed: results.filter(r => r.action === "failed").length,
    stats,
  })
}
