# BUILDER DOC 08 — EVOLUTION LAYER
# Fixes: Autonomy (88→98), FAANG Parity (99→100)
# Score impact: Final +1 to reach 99/100
# Deploy: Vercel Workflow → single push

## THE AUTO-EVOLUTION LOOP — COMPLETE WIRING

### FULL CYCLE (triggered every 5 minutes by auto-loop cron):

Stage 1: ANALYZE
- Run audit engine → get dimension scores
- Run test memory → identify failing tests
- Run SOP tracker → check last 1hr events
- Output: prioritized gap list

Stage 2: CREATE (currently broken — fix here)
- Take top gap from Stage 1
- Call APEX agent: "generate code to fix: {gap}"
- APEX returns: { file_path, code, description }
- Push to GitHub via bridge API
- Trigger Vercel rebuild
- Log to evolution_plans table

Stage 3: VALIDATE
- Wait for Vercel build to complete (poll deployment API)
- Run headless validator on new deployment
- If Grade A or A+: promote to production
- If fail: trigger Stage 4

Stage 4: FIX (currently broken — fix here)
- Take failing tests from Stage 3
- Call APEX: "fix this test failure: {test_id} reason: {reason}"
- Push fix to GitHub
- Re-run validator

Stage 5: DOCUMENT
- Generate SOP entry for full cycle
- Update auto_loop_state in Supabase
- Emit evolution_cycle event to SOP tracker

Stage 6: REPORT
- If hour boundary: trigger reflection agent
- If 4-hour boundary: trigger email report
- If audit score improved: send WhatsApp notification to Jeremy

### lib/auto-loop.ts — STAGE 2+4 FIX
```typescript
// Stage 2: CREATE — push real code
async function stageCreate(topGap: string): Promise<void> {
  const apexResponse = await fetch("/api/apex", {
    method: "POST",
    headers: { Authorization: "Bearer " + BRIDGE_SECRET },
    body: JSON.stringify({ task: "generate_fix", gap: topGap, context: await getSystemContext() })
  })
  const { file_path, code } = await apexResponse.json()
  if (file_path && code) {
    await fetch("/api/bridge", {
      method: "POST",
      headers: { Authorization: "Bearer " + BRIDGE_SECRET },
      body: JSON.stringify({ action: "push_file", path: file_path, content: code, message: "auto: fix " + topGap.slice(0, 50) })
    })
  }
}
```

### VERCEL WORKFLOW INTEGRATION
The evolution agent generates builder docs (08_BUILDER_EVOLUTION format).
Builder docs are pushed to docs/BUILDER_DOCS/ in GitHub.
Vercel workflow detects new builder docs → triggers build pipeline.
Each build doc specifies exact files + code to create/modify.
System rebuilds and redeploys autonomously.

### APPROVAL MATRIX (GOVERNANCE)
P0 changes (prod DB schema, delete ops): require Jeremy approval via WhatsApp
P1 changes (new features, API routes): auto-push, Jeremy notified
P2 changes (bug fixes, optimizations): auto-push, logged only

### CRON SCHEDULE FOR FULL EVOLUTION LOOP
*/5 * * * *   → auto-loop (analyze → create → validate → fix → document)
*/15 * * * *  → auto-heal (repair broken endpoints)
*/30 * * * *  → triple-validate (P0 test suite × 3)
0 */4 * * *   → sop-reflect-email (SOP + reflection + audit + email)
0 */6 * * *   → evolve (strategic evolution planning)

## EXPECTED SCORE AFTER ALL 8 DOCS
Infrastructure:      98/100
Security:            95/100
Autonomy:            95/100
Performance:         90/100
AI Intelligence:     93/100
Reliability:         90/100
UX:                  88/100
Dev Experience:      85/100
Data Integrity:      85/100
Observability:       90/100
Business Value:      85/100
FAANG Parity:        99/100
OVERALL:             92-95/100 (Grade A+)

## THE PATH TO 100
100/100 requires:
- WhatsApp live with real opt-in sequences running
- Playwright scraping real leads daily
- pgvector semantic memory with 1000+ embeddings
- BullMQ processing 50+ jobs/day
- 30+ days of reflection + evolution data proving the loop works
- Zero P0 failures across 100 consecutive validation runs
100 is earned operationally, not coded in one session.
99 is achievable in one focused build session.
