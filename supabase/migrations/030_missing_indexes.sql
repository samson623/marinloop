-- 030_missing_indexes.sql
-- Performance indexes identified in security audit.
-- All use IF NOT EXISTS — safe to re-run.

-- push_subscriptions: every push delivery queries by user_id to find endpoint
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON push_subscriptions(user_id);

-- push_subscriptions: stale endpoint cleanup looks up by endpoint URL
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint
  ON push_subscriptions(endpoint);

-- schedules: active schedule queries filter by user_id + active status
CREATE INDEX IF NOT EXISTS idx_schedules_user_active
  ON schedules(user_id, active);

-- medications: drug interaction + name search queries
CREATE INDEX IF NOT EXISTS idx_medications_user_name
  ON medications(user_id, name);

-- dose_logs: adherence history and schedule analysis joins by medication_id
CREATE INDEX IF NOT EXISTS idx_dose_logs_medication_id
  ON dose_logs(medication_id);

-- dose_logs: timeline and schedule analysis queries by schedule_id
CREATE INDEX IF NOT EXISTS idx_dose_logs_schedule_id
  ON dose_logs(schedule_id);
