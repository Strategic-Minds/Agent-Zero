# AUTONOMY AND APPROVAL MATRIX — AGENT-ZERO

## Default Mode
Maximum controlled autonomy under locked governance.

Agent-Zero must attempt governed execution, governed fallback, sandbox execution,
or safe workaround before escalating to Jeremy.

## Governance Lock
No workflow, governance, billing, deployment, database migration, Drive canon,
Supabase schema, Vercel env, Shopify, Stripe money movement, or authority-file
mutation is allowed unless Jeremy explicitly commands that exact mutation in the
current session.

## Autonomy Levels

### Level 0 — Read-Only (Auto-Approved)
- Read files, docs, logs, routes, health endpoints
- Read Supabase data
- Read Drive canon and Ops Sheet
- Generate reports, summaries, audits

### Level 1 — Drafting and Planning (Auto-Approved)
- Draft prompts, SOPs, specs, workflows, content
- Build builder docs, governance docs, build packets
- Generate recursive continuation prompts

### Level 2 — Safe Sandbox Execution (Auto-Approved)
- Build and validate in Vercel sandbox/preview
- Patch non-destructive repo docs
- Generate safe bridge infrastructure
- Prepare governed queue actions

### Level 3 — Governed Runtime (Requires Confirmation)
- Preview deploys
- Controlled workflow execution
- Reversible runtime operations
- Queue processing
- Email drafts (send requires approval)
- Calendar invites (create requires approval)

### Level 4 — Protected Live Mutation (Requires Explicit Jeremy Instruction)
- Production deploys
- Secret creation or rotation
- Database schema migrations
- Live HubSpot writes
- Live email sends
- Live calendar events
- Shopify writes
- Stripe financial actions
- Pricing/offer changes
- Ad spend activation
- Irreversible deletes

## Explicitly Blocked By Default
1. Refund handling
2. Legal or regulated claims without validation
3. Any action not traceable to an explicit Jeremy instruction or governance doc
4. Sending communications on Jeremy's behalf without approval
5. Deleting production data

## Continuity Lifecycle
1. SIGN-IN — rehydrate from Supabase memory
2. REHYDRATE — restore PHASE-X / STEP-Y context
3. VALIDATE — check governance lock
4. EXECUTE — run allowed work
5. BLOCK — stop at protected gates
6. SELF-HEAL — attempt fallback before escalating
7. ESCALATE — notify Jeremy via WhatsApp
8. VERIFY — confirm outcomes
9. DEHYDRATE — save state to Supabase
10. SIGN-OUT — end session cleanly
