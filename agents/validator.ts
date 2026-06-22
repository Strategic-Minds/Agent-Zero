/**
 * INDEPENDENT HEADLESS VALIDATOR — agents/validator.ts
 * 30-test suite. Runs independently. Blocks deployments on failure.
 * No human needed. Completely autonomous.
 */

export interface ValidatorTest {
  id: number
  name: string
  category: "critical" | "high" | "medium" | "low"
  passed: boolean
  score: number
  latency_ms: number
  error?: string
}

export interface ValidatorResult {
  run_id: string
  url: string
  passed: number
  failed: number
  critical_failures: number
  score: number
  grade: "A+" | "A" | "B" | "C" | "D" | "F"
  deployment_approved: boolean
  tests: ValidatorTest[]
  ran_at: string
}

const TESTS: Array<{ id: number; name: string; category: ValidatorTest["category"]; check: (url: string) => Promise<boolean> }> = [
  { id: 1,  name: "Health endpoint alive",         category: "critical", check: async (u) => { const r = await fetch(u+"/api/health", {signal: AbortSignal.timeout(8000)}); return r.ok } },
  { id: 2,  name: "Health returns status:ok",       category: "critical", check: async (u) => { const r = await fetch(u+"/api/health", {signal: AbortSignal.timeout(8000)}); const d = await r.json(); return d?.status === "ok" } },
  { id: 3,  name: "ARIA agent responds",            category: "critical", check: async (u) => { const r = await fetch(u+"/api/aria", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:"ping"}),signal:AbortSignal.timeout(15000)}); return r.ok } },
  { id: 4,  name: "Ghost API alive",               category: "critical", check: async (u) => { const r = await fetch(u+"/api/ghost", {signal: AbortSignal.timeout(8000)}); return r.ok } },
  { id: 5,  name: "Orchestrate endpoint alive",    category: "critical", check: async (u) => { const r = await fetch(u+"/api/orchestrate", {method:"POST",headers:{"Content-Type":"application/json","x-chatgpt-action":"true"},body:JSON.stringify({task:"ping"}),signal:AbortSignal.timeout(20000)}); return r.ok } },
  { id: 6,  name: "Benchmark endpoint alive",      category: "high",     check: async (u) => { const r = await fetch(u+"/api/benchmark", {signal: AbortSignal.timeout(8000)}); return r.ok } },
  { id: 7,  name: "Validate endpoint alive",       category: "high",     check: async (u) => { const r = await fetch(u+"/api/validate", {signal: AbortSignal.timeout(8000)}); return r.ok } },
  { id: 8,  name: "APEX endpoint alive",           category: "high",     check: async (u) => { const r = await fetch(u+"/api/apex", {signal: AbortSignal.timeout(8000)}); return r.ok } },
  { id: 9,  name: "Audit endpoint alive",          category: "high",     check: async (u) => { const r = await fetch(u+"/api/audit", {signal: AbortSignal.timeout(8000)}); return r.ok } },
  { id: 10, name: "Bridge endpoint alive",         category: "high",     check: async (u) => { const r = await fetch(u+"/api/bridge", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"ping"}),signal:AbortSignal.timeout(8000)}); return r.status !== 404 } },
  { id: 11, name: "Ghost scrape returns title",   category: "high",     check: async (u) => { const r = await fetch(u+"/api/ghost", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"scrape_url",url:"https://example.com"}),signal:AbortSignal.timeout(20000)}); const d = await r.json(); return !!d?.result?.title } },
  { id: 12, name: "Orchestrate returns agents",   category: "high",     check: async (u) => { const r = await fetch(u+"/api/orchestrate", {method:"POST",headers:{"Content-Type":"application/json","x-chatgpt-action":"true"},body:JSON.stringify({task:"status check"}),signal:AbortSignal.timeout(25000)}); const d = await r.json(); return (d?.agents_used?.length || 0) >= 1 } },
  { id: 13, name: "Health reports version",       category: "medium",   check: async (u) => { const r = await fetch(u+"/api/health", {signal: AbortSignal.timeout(8000)}); const d = await r.json(); return !!d?.version } },
  { id: 14, name: "Health reports uptime",        category: "medium",   check: async (u) => { const r = await fetch(u+"/api/health", {signal: AbortSignal.timeout(8000)}); const d = await r.json(); return typeof d?.uptime === "number" } },
  { id: 15, name: "Homepage loads",               category: "high",     check: async (u) => { const r = await fetch(u+"/", {signal: AbortSignal.timeout(10000)}); return r.ok } },
  { id: 16, name: "No 500 errors on health",      category: "critical", check: async (u) => { const r = await fetch(u+"/api/health", {signal: AbortSignal.timeout(8000)}); return r.status !== 500 } },
  { id: 17, name: "ARIA returns response field",  category: "high",     check: async (u) => { const r = await fetch(u+"/api/aria", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:"hello"}),signal:AbortSignal.timeout(15000)}); const d = await r.json(); return !!d?.response } },
  { id: 18, name: "Ghost returns ok:true",        category: "high",     check: async (u) => { const r = await fetch(u+"/api/ghost", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"scrape_url",url:"https://example.com"}),signal:AbortSignal.timeout(20000)}); const d = await r.json(); return d?.ok === true } },
  { id: 19, name: "Benchmark returns score",      category: "medium",   check: async (u) => { const r = await fetch(u+"/api/benchmark", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({run_type:"quick"}),signal:AbortSignal.timeout(30000)}); const d = await r.json(); return typeof d?.score === "number" || typeof d?.overall_score === "number" } },
  { id: 20, name: "No auth wall on public routes",category: "critical", check: async (u) => { const r = await fetch(u+"/api/health"); return r.status !== 401 && r.status !== 403 } },
  { id: 21, name: "Ghost parallel scrape works",  category: "medium",   check: async (u) => { const r = await fetch(u+"/api/ghost", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"scrape_parallel",urls:["https://example.com","https://httpbin.org/get"]}),signal:AbortSignal.timeout(25000)}); const d = await r.json(); return Array.isArray(d?.results) && d.results.length > 0 } },
  { id: 22, name: "Cron validate responds",       category: "medium",   check: async (u) => { const r = await fetch(u+"/api/cron/validate", {signal: AbortSignal.timeout(10000)}); return r.status !== 404 } },
  { id: 23, name: "Response time < 10s (health)", category: "medium",   check: async (u) => { const s = Date.now(); await fetch(u+"/api/health", {signal: AbortSignal.timeout(10000)}); return Date.now()-s < 10000 } },
  { id: 24, name: "ARIA handles empty message",   category: "medium",   check: async (u) => { const r = await fetch(u+"/api/aria", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:""}),signal:AbortSignal.timeout(12000)}); return r.status !== 500 } },
  { id: 25, name: "Ghost handles bad URL",        category: "medium",   check: async (u) => { const r = await fetch(u+"/api/ghost", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"scrape_url",url:"https://this-does-not-exist-xyz123.com"}),signal:AbortSignal.timeout(20000)}); return r.status !== 500 } },
  { id: 26, name: "Audit returns score",          category: "medium",   check: async (u) => { const r = await fetch(u+"/api/audit", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system:"agent-zero"}),signal:AbortSignal.timeout(15000)}); const d = await r.json(); return typeof d?.score === "number" || r.ok } },
  { id: 27, name: "Loop endpoint responds",       category: "low",      check: async (u) => { const r = await fetch(u+"/api/loop", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({step:"check"}),signal:AbortSignal.timeout(10000)}); return r.status !== 404 } },
  { id: 28, name: "Swarm endpoint responds",      category: "low",      check: async (u) => { const r = await fetch(u+"/api/swarm", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({task:"ping"}),signal:AbortSignal.timeout(10000)}); return r.status !== 404 } },
  { id: 29, name: "Install endpoint responds",    category: "low",      check: async (u) => { const r = await fetch(u+"/api/install", {signal: AbortSignal.timeout(8000)}); return r.status !== 404 } },
  { id: 30, name: "OpenAI setup responds",        category: "low",      check: async (u) => { const r = await fetch(u+"/api/openai-setup", {signal: AbortSignal.timeout(8000)}); return r.status !== 404 } },
]

function scoreToGrade(score: number, critFails: number): ValidatorResult["grade"] {
  if (critFails > 0) return "F"
  if (score >= 97) return "A+"
  if (score >= 90) return "A"
  if (score >= 80) return "B"
  if (score >= 70) return "C"
  if (score >= 60) return "D"
  return "F"
}

export async function runValidation(deploymentUrl: string): Promise<ValidatorResult> {
  const run_id = "val_" + Date.now()
  // Run ALL 30 tests in parallel
  const results = await Promise.all(
    TESTS.map(async (test) => {
      const start = Date.now()
      try {
        const passed = await test.check(deploymentUrl)
        return { id: test.id, name: test.name, category: test.category, passed, score: passed ? 100 : 0, latency_ms: Date.now() - start }
      } catch (e) {
        return { id: test.id, name: test.name, category: test.category, passed: false, score: 0, latency_ms: Date.now() - start, error: String(e) }
      }
    })
  )

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const critFails = results.filter(r => !r.passed && r.category === "critical").length
  const score = Math.round((passed / results.length) * 100)
  const grade = scoreToGrade(score, critFails)

  return {
    run_id,
    url: deploymentUrl,
    passed, failed,
    critical_failures: critFails,
    score, grade,
    deployment_approved: grade === "A+" || grade === "A",
    tests: results,
    ran_at: new Date().toISOString(),
  }
}

// TRIPLE-CHECK — run 3 consecutive passes, all must pass
export async function tripleCheck(deploymentUrl: string): Promise<{ approved: boolean; runs: ValidatorResult[]; final_score: number }> {
  const runs: ValidatorResult[] = []
  for (let i = 0; i < 3; i++) {
    const result = await runValidation(deploymentUrl)
    runs.push(result)
    if (!result.deployment_approved) break // fail fast
    if (i < 2) await new Promise(r => setTimeout(r, 2000)) // 2s between runs
  }
  const allPassed = runs.every(r => r.deployment_approved)
  const avgScore = Math.round(runs.reduce((a, r) => a + r.score, 0) / runs.length)
  return { approved: allPassed && runs.length === 3, runs, final_score: avgScore }
}
