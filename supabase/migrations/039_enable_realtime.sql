-- 039_enable_realtime.sql
-- Enable Supabase Realtime on key tables so useRealtimeSync can receive live updates.
-- REPLICA IDENTITY FULL ensures UPDATE and DELETE events include the full old row.

ALTER TABLE medications    REPLICA IDENTITY FULL;
ALTER TABLE dose_logs      REPLICA IDENTITY FULL;
ALTER TABLE vitals         REPLICA IDENTITY FULL;
ALTER TABLE notes          REPLICA IDENTITY FULL;
ALTER TABLE appointments   REPLICA IDENTITY FULL;
ALTER TABLE reminders      REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE medications;
ALTER PUBLICATION supabase_realtime ADD TABLE dose_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE vitals;
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE reminders;
