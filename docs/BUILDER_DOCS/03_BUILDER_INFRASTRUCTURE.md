# BUILDER DOC 03 — INFRASTRUCTURE LAYER
# Fixes: Infrastructure (69→95), Reliability (63→90), Security (68→92), Performance (64→90)
# Score impact: +18 points
# Deploy: Vercel Workflow → single push

## FILES TO CREATE/MODIFY

### lib/redis.ts (CREATE)
Upstash Redis client — used for caching, rate limiting, and job queuing.

```typescript
import { Redis } from "@upstash/redis"
export const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
export async function cacheGet<T>(key: string): Promise<T | null>
export async function cacheSet(key: string, value: unknown, ttl_seconds = 300): Promise<void>
export async function cacheDel(key: string): Promise<void>
```

### lib/rate-limit.ts (CREATE)
Per-IP rate limiting using Upstash Ratelimit.

```typescript
import { Ratelimit } from "@upstash/ratelimit"
export const publicRatelimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m") })
export const authRatelimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, "1 m") })
export async function checkRateLimit(identifier: string, type: "public" | "auth"): Promise<{ allowed: boolean; remaining: number }>
```

### lib/queue.ts (CREATE)
BullMQ async job queue for background processing.

```typescript
import { Queue, Worker } from "bullmq"
export const discoveryQueue = new Queue("discovery", { connection: redisConnection })
export const scoringQueue = new Queue("scoring", { connection: redisConnection })
export const outreachQueue = new Queue("outreach", { connection: redisConnection })
export async function enqueueDiscovery(params: DiscoveryJob): Promise<string>
export async function enqueueScoring(leadId: string): Promise<string>
export async function enqueueOutreach(leadId: string, message: string): Promise<string>
```

### middleware.ts (CREATE/UPDATE)
Edge middleware — runs on every request before it hits the function.

```typescript
export async function middleware(req: NextRequest) {
  // 1. Rate limiting
  const ip = req.ip || req.headers.get("x-forwarded-for") || "anonymous"
  const { allowed } = await checkRateLimit(ip, isPublic ? "public" : "auth")
  if (!allowed) return new Response("Rate limit exceeded", { status: 429 })

  // 2. Security headers
  const res = NextResponse.next()
  res.headers.set("X-Frame-Options", "DENY")
  res.headers.set("X-Content-Type-Options", "nosniff")
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  res.headers.set("Content-Security-Policy", "default-src self; script-src self unsafe-eval; ...")
  return res
}
```

### sentry.server.config.ts (CREATE)
```typescript
import * as Sentry from "@sentry/nextjs"
Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1, environment: process.env.VERCEL_ENV })
```

### sentry.client.config.ts (CREATE)
```typescript
import * as Sentry from "@sentry/nextjs"
Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1, replaysSessionSampleRate: 0.1 })
```

### next.config.js (MODIFY)
Wrap with withSentryConfig().

## NPM PACKAGES
@upstash/redis
@upstash/ratelimit
bullmq
@sentry/nextjs

## ENV VARS
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
SENTRY_DSN
SENTRY_ORG
SENTRY_PROJECT

## EXPECTED SCORE AFTER THIS DOC
Infrastructure: 69 → 90 (+21)
Security: 68 → 88 (+20)
Reliability: 63 → 87 (+24)
Performance: 64 → 85 (+21)
Observability: 44 → 75 (+31)
Overall: 82 → 92 (+10)
