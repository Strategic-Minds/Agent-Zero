# Automation Workflow Builder Doc

## Workflow Name
/api/cron/auto-heal — Complete Wiring Reference

## Current Score
20/100 — No real agent import, no Supabase, no AI

## Required Wiring

```typescript
import { runValidation } from "@/agents/validator"
import { runApex } from "@/agents/apex"
import { reflect } from "@/agents/reflection"
import { getSupabaseAdmin } from "@/lib/supabase"
```

## What auto-heal must do
1. Call runValidation(productionUrl)
2. If score >= 80: upsert heal_log with status=healthy, return
3. If score < 80: call runApex({ task: "fix failing routes", failing_tests: [...] })
4. Push fix to GitHub
5. Wait 150s
6. Re-validate
7. Call reflect() with pre/post scores
8. Upsert heal_log to Supabase

## Supabase Table Needed
```sql
create table if not exists heal_logs (
  id uuid primary key default gen_random_uuid(),
  run_id text,
  pre_score int,
  post_score int,
  fixes_applied jsonb,
  status text,
  created_at timestamp default now()
);
```

## Implementation Priority
P0 — implement immediately
