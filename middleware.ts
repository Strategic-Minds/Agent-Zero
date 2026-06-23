import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// In-memory rate limit (per edge instance)
const rateMap = new Map<string, { count: number; reset: number }>()
const RATE_LIMIT = 60 // requests
const RATE_WINDOW = 60000 // per minute

function getRateKey(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}

function checkRateLimit(key: string): { ok: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateMap.get(key)
  if (!entry || now > entry.reset) {
    rateMap.set(key, { count: 1, reset: now + RATE_WINDOW })
    return { ok: true, remaining: RATE_LIMIT - 1 }
  }
  entry.count++
  if (entry.count > RATE_LIMIT) return { ok: false, remaining: 0 }
  return { ok: true, remaining: RATE_LIMIT - entry.count }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const res = NextResponse.next()

  // Security headers on all responses
  res.headers.set("X-Content-Type-Options", "nosniff")
  res.headers.set("X-Frame-Options", "DENY")
  res.headers.set("X-XSS-Protection", "1; mode=block")
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
  res.headers.set(
    "Content-Security-Policy",
    "default-src \'self\'; script-src \'self\' \'unsafe-inline\' \'unsafe-eval\' https://vercel.live; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: https:; connect-src \'self\' https://api.openai.com https://api.groq.com https://*.supabase.co wss://*.supabase.co;"
  )

  // Rate limit API routes
  if (pathname.startsWith("/api/")) {
    // Skip rate limit for internal cron calls
    const cronSecret = req.headers.get("authorization")
    if (cronSecret === `Bearer ${process.env.CRON_SECRET}`) return res

    const key = getRateKey(req)
    const { ok, remaining } = checkRateLimit(key)
    res.headers.set("X-RateLimit-Limit", String(RATE_LIMIT))
    res.headers.set("X-RateLimit-Remaining", String(remaining))

    if (!ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in 60 seconds." },
        { status: 429, headers: { "Retry-After": "60" } }
      )
    }
  }

  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
