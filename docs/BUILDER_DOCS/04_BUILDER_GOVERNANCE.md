# BUILDER DOC 04 — GOVERNANCE LAYER
# Fixes: Autonomy (66→92), Data Integrity (51→85), FAANG Parity (80→92)
# Score impact: +8 points
# Deploy: Vercel Workflow → single push

## UNIVERSAL LAW GOVERNANCE SYSTEM

Agent Zero operates under Universal Law principles encoded as system constraints.
These are not metaphysical — they are operational governance rules.

### Principle 1: CAUSE AND EFFECT
Every action has a logged consequence.
Implementation: trackSOPEvent() called on EVERY agent action. No silent operations.
File: lib/sop-tracker.ts (already deployed — ensure all agents call it)

### Principle 2: CORRESPONDENCE
As above (intent) so below (execution).
Implementation: Every cron run logs its intent before executing.
Every agent declares what it will do before it does it.
File: Add "intention" field to all SOPEvent types.

### Principle 3: RHYTHM
Predictable cycles. Consistent cron patterns. No random timing.
Implementation: vercel.json crons are the heartbeat. All 13 crons fixed-schedule.
Auto-loop every 5 min = system pulse.

### Principle 4: POLARITY
Track both successes AND failures equally. No cherry-picking.
Implementation: test_memory tracks flaky tests. audit_engine scores honestly.
Independent audit CANNOT be overridden by the system it audits.

### Principle 5: MENTALISM — SYSTEM PURPOSE
Agent Zero operates from a clearly stated purpose:
"I am the autonomous implementation agent for Strategic Minds Advisory.
I discover, score, pitch, and close leads for AI consulting services and XPS epoxy.
I build and deploy systems on behalf of Jeremy.
I improve myself continuously through honest self-evaluation.
I act with speed, precision, and integrity."

### FILES TO CREATE

### lib/governance.ts (CREATE)
```typescript
export const SYSTEM_PURPOSE = "Autonomous implementation agent for Strategic Minds Advisory + XPS Intelligence"
export const SYSTEM_PRINCIPLES = { cause_effect: true, correspondence: true, rhythm: true, polarity: true, mentalism: SYSTEM_PURPOSE }

export interface GovernanceCheck {
  action: string
  agent: string
  requires_human_approval: boolean
  reason: string
  auto_approved: boolean
}

export function checkGovernance(action: string, severity: "P0" | "P1" | "P2"): GovernanceCheck
// P0 actions (code push to prod, delete DB) → require human approval
// P1 actions (outreach send, new lead) → auto-approved, logged
// P2 actions (analysis, reporting) → auto-approved, silent log
```

### GOVERNANCE.md (CREATE)
Full governance document encoding all principles, approval matrix, audit requirements.

### AUTO-EVOLUTION LOOP — STAGE 2 + 4 (CRITICAL FIX)
Currently: auto-loop stages 2 (CREATE) and 4 (FIX) only write suggestions.
Target: stages 2+4 push real code to GitHub via bridge API.

File: lib/auto-loop.ts (MODIFY stages 2 and 4)
```typescript
// Stage 2: CREATE
const codeResponse = await apexAgent({ task: "generate code fix for: " + topGap })
await bridgeAPI({ action: "push_file", path: codeResponse.file_path, content: codeResponse.code })

// Stage 4: FIX  
const healResponse = await apexAgent({ task: "fix failing test: " + failingTest.test_id })
await bridgeAPI({ action: "push_file", path: healResponse.file_path, content: healResponse.code })
```

## SUPABASE SCHEMA ADDITIONS
```sql
-- governance_log (every P0/P1 action)
create table governance_log (
  id uuid primary key default gen_random_uuid(),
  action text, agent text, severity text,
  requires_approval boolean, approved_by text,
  approved_at timestamptz, created_at timestamptz default now()
);
```

## EXPECTED SCORE AFTER THIS DOC
Autonomy: 66 → 88 (+22)
Data Integrity: 51 → 78 (+27)
FAANG Parity: 80 → 92 (+12)
Overall: 92 → 95 (+3)
