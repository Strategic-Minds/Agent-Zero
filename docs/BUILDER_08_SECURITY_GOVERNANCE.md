# SECURITY & GOVERNANCE — SPEC
# Builder Doc 08 | Auth, Secrets, Autonomy Matrix

## AUTHENTICATION LAYERS
1. CRON_SECRET — Vercel cron triggers + validate/workflow APIs
2. BRIDGE_SECRET — Internal agent-to-agent (APEX, GHOST, Bridge)
3. SUPABASE_SERVICE_KEY — Admin DB operations (server only, never client)
4. GITHUB_TOKEN — Repo read/write for APEX auto-push
5. Owner WhatsApp — only Jeremy receives autonomous notifications

## SECRETS (Vercel Environment Variables)
GROQ_API_KEY          Primary LLM — Llama 3.3 70B + 8B
OPENAI_API_KEY        GPT-4o fallback + embeddings
ANTHROPIC_API_KEY     Claude 3.5 Sonnet (best coding)
SUPABASE_URL          Database endpoint
SUPABASE_ANON_KEY     Client-safe DB key
SUPABASE_SERVICE_KEY  Admin DB key (server only)
BRIDGE_SECRET         Internal API auth
CRON_SECRET           Cron route protection
GITHUB_TOKEN          Repo operations
OWNER_WHATSAPP        Jeremy phone number
VERCEL_API_TOKEN      Self-deployment operations

## 5-LEVEL AUTONOMY MATRIX
Level 1 (Full Auto — no log needed):
  Memory reads, health checks, capability registry

Level 2 (Full Auto — logged to audit_log):
  Lead discovery, lead scoring, data storage
  Benchmark runs, self-tests, file reads

Level 3 (Auto — logged + notified):
  Code generation, doc updates, GitHub commits
  Outreach draft generation, proposal drafts

Level 4 (Requires Approval — queued):
  External message sends (WhatsApp blast)
  Public deployment of new features
  Payment processing, external API calls with cost

Level 5 (Jeremy only — hard block):
  Architecture changes
  API key rotation
  Billing/subscription changes
  Deleting production data

## SECURITY HARDENING CHECKLIST
- All cron routes: verify x-cron-secret or Authorization header
- All APEX/GHOST routes: verify BRIDGE_SECRET
- No secrets in code — all via process.env
- No secrets in logs — redact before logging
- CORS: restricted to known origins only
- Rate limiting: per-route, per-IP
- Input validation: Zod schema on all POST bodies
