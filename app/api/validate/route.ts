import { NextRequest, NextResponse } from "next/server"
import { runValidation, tripleCheck } from "@/agents/validator"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

export async function GET() {
  return NextResponse.json({ agent: "Independent Headless Validator", tests: 30, description: "POST with {url, triple_check?} to run validation" })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { url?: string; triple_check?: boolean }
  const url = body.url || (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "https://agent-zero-beta.vercel.app")
  try {
    if (body.triple_check) {
      const result = await tripleCheck(url)
      return NextResponse.json({ ok: true, mode: "triple_check", ...result })
    }
    const result = await runValidation(url)
    return NextResponse.json({ ok: true, mode: "single", ...result })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
