create or replace function public.create_medication_bundle(
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
returns uuid
language plpgsql
security invoker
as $$
declare
  auth_user_id uuid := auth.uid();
  med_id uuid;
  t text;
begin
  if auth_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.medications (
    user_id, name, dosage, instructions, warnings, freq, color, icon
  ) values (
    auth_user_id, medication_name, medication_dosage, medication_instructions,
    medication_warnings, medication_freq, medication_color, medication_icon
  ) returning id into med_id;

  foreach t in array schedule_times loop
    insert into public.schedules (
      medication_id, user_id, time, days, food_context_minutes, active
    ) values (
      med_id, auth_user_id, t, schedule_days, 0, true
    );
  end loop;

  insert into public.refills (
    medication_id, user_id, current_quantity, total_quantity, refill_date, pharmacy
  ) values (
    med_id, auth_user_id, refill_current_quantity, refill_total_quantity, refill_date, refill_pharmacy
  )
  on conflict (medication_id, user_id)
  do update set
    current_quantity = excluded.current_quantity,
    total_quantity = excluded.total_quantity,
    refill_date = excluded.refill_date,
    pharmacy = excluded.pharmacy,
    updated_at = timezone('utc', now());

  return med_id;
end;
$$;
