/**
 * CRON WRAPPER — lib/cron-wrapper.ts
 * Fix 5: Dead letter queue — every cron failure is persisted to Supabase
 * Wrap your cron handlers with withCronDLQ() for automatic failure tracking
 */
import { getSupabaseAdmin } from "@/lib/supabase"

export interface CronResult {
  ok: boolean
  cron_name: string
  duration_ms: number
  result?: unknown
  error?: string
  retries?: number
}

async function logToDLQ(cronName: string, error: string, attempt: number) {
  try {
    const db = getSupabaseAdmin()
    await db.from("cron_failures" as any).upsert({
      cron_name: cronName,
      error_message: error.slice(0, 500),
      attempt,
      failed_at: new Date().toISOString(),
      resolved: false,
    })
  } catch { /* never fail the failure logger */ }
}

async function logSuccess(cronName: string, durationMs: number) {
  try {
    const db = getSupabaseAdmin()
    await db.from("cron_runs" as any).upsert({
      cron_name: cronName,
      ran_at: new Date().toISOString(),
      duration_ms: durationMs,
      status: "success",
    })
    // Clear any previous failures
    await db.from("cron_failures" as any)
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("cron_name", cronName)
      .eq("resolved", false)
  } catch { /* non-fatal */ }
}

export async function withCronDLQ<T>(
  cronName: string,
  fn: () => Promise<T>,
  options: { maxRetries?: number; retryDelayMs?: number } = {}
): Promise<CronResult> {
  const { maxRetries = 2, retryDelayMs = 2000 } = options
  const start = Date.now()

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn()
      const durationMs = Date.now() - start
      await logSuccess(cronName, durationMs)
      return { ok: true, cron_name: cronName, duration_ms: durationMs, result, retries: attempt }
    } catch (e) {
      const errMsg = String(e)
      await logToDLQ(cronName, errMsg, attempt + 1)
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, retryDelayMs * (attempt + 1)))
      } else {
        return { ok: false, cron_name: cronName, duration_ms: Date.now() - start, error: errMsg, retries: attempt }
      }
    }
  }
  return { ok: false, cron_name: cronName, duration_ms: Date.now() - start, error: "Max retries exceeded" }
}

// Get failed crons for monitoring dashboard
export async function getFailedCrons(limit = 20) {
  try {
    const db = getSupabaseAdmin()
    const { data } = await db
      .from("cron_failures" as any)
      .select("*")
      .eq("resolved", false)
      .order("failed_at", { ascending: false })
      .limit(limit)
    return data || []
  } catch { return [] }
}
