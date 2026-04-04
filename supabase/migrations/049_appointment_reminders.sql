ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE;

ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.managed_profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_reminders_appointment_id
  ON public.reminders(appointment_id);

CREATE INDEX IF NOT EXISTS idx_reminders_profile_id
  ON public.reminders(profile_id);
