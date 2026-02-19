# MedFlow Care — Database Setup

Run these steps **once** per Supabase project to set up the database correctly.

---

## Option A: Supabase Dashboard (No CLI Required)

1. **Open your project**: [Supabase Dashboard](https://supabase.com/dashboard) → select your project.

2. **SQL Editor** → **New query**.

3. **Step 1 — Base schema**  
   Copy and run the entire contents of `supabase/schema.sql`.  
   Wait for it to complete (tables, indexes, RLS, triggers, `create_medication_bundle`).

4. **Step 2 — Migrations**  
   Copy and run the entire contents of `supabase/run-migrations.sql`.  
   This adds barcode, push_subscriptions, ai_conversations, and updates `create_medication_bundle` to use `auth_user_id`.

5. **Confirm**  
   - Tables: `profiles`, `medications`, `schedules`, `dose_logs`, `appointments`, `refills`, `notes`, `notifications`, `push_subscriptions`, `ai_conversations`
   - Function: `create_medication_bundle` (uses `auth_user_id`, not `current_user`)
   - RLS enabled on all user-facing tables

---

## Option B: Supabase CLI (If Installed)

```bash
supabase link          # link project (first time only)
supabase db push       # applies schema + all migrations
```

---

## Verification Query

Run this in the SQL Editor to confirm the function uses `auth_user_id`:

```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'create_medication_bundle';
```

The definition should include `auth_user_id uuid := auth.uid();` — **not** `current_user`.
