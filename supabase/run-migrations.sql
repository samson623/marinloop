-- ============================================================
-- MedFlow Care: Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- 001: Barcode column for medications
ALTER TABLE public.medications
ADD COLUMN IF NOT EXISTS barcode text;
CREATE INDEX IF NOT EXISTS idx_medications_barcode ON public.medications(barcode)
WHERE barcode IS NOT NULL;

-- 002: Push subscriptions + update policy
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  device_info text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS trg_push_subscriptions_user_id ON public.push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_user_id BEFORE INSERT ON public.push_subscriptions
FOR EACH ROW EXECUTE PROCEDURE public.set_user_id_from_auth();
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select_own ON public.push_subscriptions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS push_subscriptions_insert_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert_own ON public.push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS push_subscriptions_update_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_update_own ON public.push_subscriptions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete_own ON public.push_subscriptions FOR DELETE USING (auth.uid() = user_id);

-- 003: AI conversations (GPT-5 nano)
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  model text,
  created_at timestamptz not null default timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_created ON public.ai_conversations(user_id, created_at desc);
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_conversations_select_own ON public.ai_conversations;
CREATE POLICY ai_conversations_select_own ON public.ai_conversations FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS ai_conversations_insert_own ON public.ai_conversations;
CREATE POLICY ai_conversations_insert_own ON public.ai_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS ai_conversations_delete_own ON public.ai_conversations;
CREATE POLICY ai_conversations_delete_own ON public.ai_conversations FOR DELETE USING (auth.uid() = user_id);

-- 004: Fix create_medication_bundle (rename current_user → auth_user_id)
CREATE OR REPLACE FUNCTION public.create_medication_bundle(
  medication_name text,
  medication_dosage text,
  medication_instructions text,
  medication_warnings text,
  medication_freq integer,
  medication_color text,
  medication_icon text,
  schedule_times text[],
  schedule_days integer[],
  refill_current_quantity integer,
  refill_total_quantity integer,
  refill_date date,
  refill_pharmacy text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  auth_user_id uuid := auth.uid();
  med_id uuid;
  t text;
BEGIN
  IF auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.medications (
    user_id, name, dosage, instructions, warnings, freq, color, icon
  ) VALUES (
    auth_user_id, medication_name, medication_dosage, medication_instructions,
    medication_warnings, medication_freq, medication_color, medication_icon
  ) RETURNING id INTO med_id;

  FOREACH t IN ARRAY schedule_times LOOP
    INSERT INTO public.schedules (
      medication_id, user_id, time, days, food_context_minutes, active
    ) VALUES (
      med_id, auth_user_id, t, schedule_days, 0, true
    );
  END LOOP;

  INSERT INTO public.refills (
    medication_id, user_id, current_quantity, total_quantity, refill_date, pharmacy
  ) VALUES (
    med_id, auth_user_id, refill_current_quantity, refill_total_quantity, refill_date, refill_pharmacy
  )
  ON CONFLICT (medication_id, user_id)
  DO UPDATE SET
    current_quantity = excluded.current_quantity,
    total_quantity = excluded.total_quantity,
    refill_date = excluded.refill_date,
    pharmacy = excluded.pharmacy,
    updated_at = timezone('utc', now());

  RETURN med_id;
END;
$$;
