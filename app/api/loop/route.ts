import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const db = getSupabaseAdmin()
    const [stateRes, histRes] = await Promise.all([
      db.from("auto_loop_state").select("*").order("started_at", { ascending: false }).limit(1).single(),
      db.from("loop_history").select("*").order("timestamp", { ascending: false }).limit(10),
    ])
    return NextResponse.json({
      current_state: stateRes.data || null,
      recent_cycles: histRes.data || [],
      loop_active: true,
      schedule: "*/5 * * * * (every 5 minutes)",
      validate_schedule: "*/30 * * * * (every 30 minutes)",
      heal_schedule: "*/15 * * * * (every 15 minutes)",
    })
  } catch (e) {
    return NextResponse.json({ error: String(e), loop_active: false })
  }
}
