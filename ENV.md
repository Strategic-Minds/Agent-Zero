# AGENT ZERO — ENVIRONMENT VARIABLES

## REQUIRED (Core)
```
GROQ_API_KEY=gsk_...          # Primary LLM (free, fast)
SUPABASE_URL=https://...      # Database
SUPABASE_ANON_KEY=eyJ...      # DB public key
SUPABASE_SERVICE_KEY=eyJ...   # DB admin key (server only)
BRIDGE_SECRET=...             # Internal API auth
GITHUB_TOKEN=ghp_...          # Repo access
GITHUB_REPO=Strategic-Minds/Agent-Zero
```

## RECOMMENDED (Expand capabilities)
```
OPENAI_API_KEY=sk-...         # GPT-4o fallback + embeddings
ANTHROPIC_API_KEY=sk-ant-...  # Claude fallback (best coding)
HUBSPOT_API_KEY=...           # CRM integration
```

## COMMUNICATION
```
WHATSAPP_BUSINESS_TOKEN=...   # Meta Business API token
WHATSAPP_PHONE_NUMBER_ID=...  # Your WhatsApp Business number ID
OWNER_WHATSAPP=+1...          # Jeremy's number for alerts
```

## AUTOMATION
```
CRON_SECRET=...               # Protects cron endpoints
RESEND_API_KEY=re_...         # Email sending
NEXT_PUBLIC_APP_URL=https://agent-zero.vercel.app
```

## HOW TO SET IN VERCEL
1. Go to: vercel.com/strategic-minds-advisory/agent-zero/settings/environment-variables
2. Add each variable above
3. Set for: Production + Preview + Development
4. Redeploy for changes to take effect

## CURRENT SCORE
Run /api/health to see env_score (target: 13/13)
