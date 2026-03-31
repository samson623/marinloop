-- Update create_medication_bundle to accept rxcui and profile_id parameters
-- that were added to the medications table in migrations 022 and 045
-- but never propagated to this RPC function.

DROP FUNCTION IF EXISTS public.create_medication_bundle(text, text, text, text, integer, text, text, text[], integer[], integer, integer, date, text);

CREATE OR REPLACE FUNCTION public.create_medication_bundle(
  medication_name text,
  medication_dosage text,
  medication_instructions text,
  medication_warnings text,
  medication_freq integer,
  medication_color text,
  medication_icon text,
  medication_rxcui text,
  schedule_times text[],
  schedule_days integer[],
  refill_current_quantity integer,
  refill_total_quantity integer,
  refill_date date,
  refill_pharmacy text,
  medication_profile_id uuid DEFAULT NULL
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
    user_id, name, dosage, instructions, warnings, freq, color, icon, rxcui, profile_id
  ) VALUES (
    auth_user_id, medication_name, medication_dosage, medication_instructions,
    medication_warnings, medication_freq, medication_color, medication_icon,
    medication_rxcui, medication_profile_id
  ) RETURNING id INTO med_id;

  FOREACH t IN ARRAY schedule_times LOOP
    INSERT INTO public.schedules (
      medication_id, user_id, time, days, food_context_minutes, active, profile_id
    ) VALUES (
      med_id, auth_user_id, t, schedule_days, 0, true, medication_profile_id
    );
  END LOOP;

  INSERT INTO public.refills (
    medication_id, user_id, current_quantity, total_quantity, refill_date, pharmacy, profile_id
  ) VALUES (
    med_id, auth_user_id, refill_current_quantity, refill_total_quantity,
    refill_date, refill_pharmacy, medication_profile_id
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
