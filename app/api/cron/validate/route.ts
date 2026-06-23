import { NextRequest, NextResponse } from "next/server"
import { runValidation } from "@/agents/validator"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const secret = url.searchParams.get("secret") || req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "") || ""
  const cronSecret = process.env.CRON_SECRET || ""
  if (secret !== cronSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const base = process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "https://agent-zero-beta.vercel.app"
  const result = await runValidation(base)
  return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() })
}
