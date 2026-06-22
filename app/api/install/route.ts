import { NextResponse } from "next/server"
import { runAutoInstaller, getInstallStatus } from "@/lib/auto-installer"
import { TOP_30_CAPABILITIES } from "@/lib/capabilities"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function GET() {
  const status = await getInstallStatus()
  return NextResponse.json({
    message: "Agent Zero — 30 Capability Auto-Installer",
    ...status,
    capabilities: TOP_30_CAPABILITIES.map(c => ({
      id: c.id, name: c.name, category: c.category,
      status: c.status, score: c.currentScore, target: c.targetScore,
      autoInstalled: c.autoInstalled,
    })),
  })
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret")
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const results = await runAutoInstaller()
  return NextResponse.json({
    message: "Auto-installer complete",
    total_processed: results.length,
    verified: results.filter(r => r.action === "verified").length,
    installed: results.filter(r => r.action === "installed").length,
    failed: results.filter(r => r.action === "failed").length,
    results,
  })
}
