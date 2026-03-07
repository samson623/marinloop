-- 038_update_delete_account_audit.sql
-- Patches delete_account_and_data() to also purge audit_logs rows
-- so account deletion is fully GDPR-complete.

CREATE OR REPLACE FUNCTION delete_account_and_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Audit trail (delete before everything else)
  DELETE FROM audit_logs WHERE user_id = uid;

  -- Care network audit log (FK → care_connections)
  DELETE FROM caregiver_alert_log
    WHERE care_connection_id IN (
      SELECT id FROM care_connections WHERE inviter_id = uid OR invitee_id = uid
    );

  -- User-owned health records
  DELETE FROM reminders             WHERE user_id = uid;
  DELETE FROM symptoms              WHERE user_id = uid;
  DELETE FROM journal_entries       WHERE user_id = uid;
  DELETE FROM vitals                WHERE user_id = uid;
  DELETE FROM beta_feedback         WHERE user_id = uid;
  DELETE FROM ai_daily_usage        WHERE user_id = uid;
  DELETE FROM ai_conversations      WHERE user_id = uid;
  DELETE FROM push_subscriptions    WHERE user_id = uid;

  -- Notification dispatch log (FK → schedules, so delete before schedules)
  DELETE FROM notification_dispatch_log
    WHERE schedule_id IN (SELECT id FROM schedules WHERE user_id = uid);

  DELETE FROM notifications         WHERE user_id = uid;

  -- Care coordination
  DELETE FROM care_connections      WHERE inviter_id = uid OR invitee_id = uid;
  DELETE FROM providers             WHERE user_id = uid;
  DELETE FROM emergency_contacts    WHERE user_id = uid;

  -- Clinical data (FK → medications)
  DELETE FROM notes                 WHERE user_id = uid;
  DELETE FROM dose_logs             WHERE user_id = uid;
  DELETE FROM schedules             WHERE user_id = uid;
  DELETE FROM refills               WHERE user_id = uid;
  DELETE FROM appointments          WHERE user_id = uid;
  DELETE FROM medications           WHERE user_id = uid;

  -- Release beta invite code so it can be reused
  UPDATE beta_invite_codes
    SET redeemed_by = NULL, redeemed_at = NULL
    WHERE redeemed_by = uid;

  -- Profile row last (other tables FK to it)
  DELETE FROM profiles WHERE id = uid;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_account_and_data() TO authenticated;
