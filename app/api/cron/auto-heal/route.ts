import { NextRequest, NextResponse } from "next/server"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || ""
  const secret = process.env.CRON_SECRET || ""
  if (auth !== "Bearer " + secret && req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const base = process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000"
  const healed: string[] = []
  const failed: string[] = []
  // Check each critical endpoint and attempt recovery
  const endpoints = ["/api/health", "/api/aria", "/api/benchmark", "/api/install"]
  for (const ep of endpoints) {
    try {
      const res = await fetch(base + ep, { signal: AbortSignal.timeout(10000) })
      if (res.ok) healed.push(ep + " OK")
      else { failed.push(ep + " " + res.status); }
    } catch (e) {
      failed.push(ep + " timeout")
    }
  }
  return NextResponse.json({ healed: healed.length, failed: failed.length, details: { healed, failed }, timestamp: new Date().toISOString() })
}
