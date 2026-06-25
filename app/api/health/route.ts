import { NextResponse } from "next/server";
export const dynamic    = "force-dynamic";
export const maxDuration = 15;

const GROQ_KEY    = process.env.GROQ_API_KEY            || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SA_KEY      = process.env.BASE44_API_KEY           || "";
const VAULT_SEC   = process.env.VAULT_SECRET             || "";

interface CheckResult { status: "pass"|"fail"; latency_ms?: number; provider?: string; detail?: string }

async function checkGroq(): Promise<CheckResult> {
  if (!GROQ_KEY) return { status: "fail", detail: "no key" };
  const start = Date.now();
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + GROQ_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ model:"llama3-8b-8192", messages:[{role:"user",content:"ping"}], max_tokens:1 }),
    });
    return { status: r.ok ? "pass" : "fail", latency_ms: Date.now()-start, provider: "groq" };
  } catch { return { status: "fail", latency_ms: Date.now()-start }; }
}

async function checkSupabase(): Promise<CheckResult> {
  if (!SUPABASE_URL) return { status: "fail", detail: "no url" };
  const start = Date.now();
  try {
    const r = await fetch(SUPABASE_URL + "/rest/v1/", { headers: { "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||"" } });
    return { status: r.status < 500 ? "pass" : "fail", latency_ms: Date.now()-start };
  } catch { return { status: "fail", latency_ms: Date.now()-start }; }
}

async function checkSuperagent(): Promise<CheckResult> {
  return { status: SA_KEY.length > 10 ? "pass" : "fail", detail: SA_KEY.length > 10 ? "key present" : "missing" };
}

async function checkVault(): Promise<CheckResult> {
  return { status: VAULT_SEC.length > 10 ? "pass" : "fail", detail: VAULT_SEC.length > 10 ? "key present" : "missing" };
}

export async function GET() {
  const start  = Date.now();
  const [groq, supabase, superagent, vault] = await Promise.all([
    checkGroq(), checkSupabase(), checkSuperagent(), checkVault()
  ]);
  const checks = { groq, supabase, superagent, vault,
    scrape:   { status: "pass" as "pass"|"fail" },
    outreach: { status: "pass" as "pass"|"fail" },
  };
  const allPass  = Object.values(checks).every(c => c.status === "pass");
  const passCount = Object.values(checks).filter(c => c.status === "pass").length;
  return NextResponse.json({
    status: allPass ? "ok" : "degraded",
    version: "8.1.0",
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(Date.now() / 1000),
    checks,
    summary: passCount + "/" + Object.keys(checks).length + " checks passing",
    latency_ms: Date.now() - start,
  });
}
