-- ============================================================
-- MarinLoop: Manual Test Push Notification
-- ============================================================
-- Run this in Supabase Dashboard → SQL Editor to manually
-- trigger a push notification for testing.
--
-- This bypasses the cron scheduler and directly calls
-- the cron-dispatch-push Edge Function via pg_net.
-- ============================================================

-- Step 1: Check that we have what we need
DO $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
  v_user_id uuid;
  v_medication_name text;
  v_schedule_time text;
  v_sub_count int;
BEGIN
  -- Get vault secrets
  SELECT decrypted_secret INTO v_supabase_url
    FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  SELECT decrypted_secret INTO v_service_role_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  IF v_supabase_url IS NULL THEN
    RAISE EXCEPTION '❌ Missing vault secret: supabase_url. Run setup-push.sql first.';
  END IF;
  IF v_service_role_key IS NULL THEN
    RAISE EXCEPTION '❌ Missing vault secret: service_role_key. Run setup-push.sql first.';
  END IF;

  -- Find a user with push subscriptions
  SELECT ps.user_id, count(*) INTO v_user_id, v_sub_count
    FROM public.push_subscriptions ps
    GROUP BY ps.user_id
    ORDER BY count(*) DESC
    LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '❌ No push subscriptions found. Enable push notifications in the app first (Profile → Push Notifications toggle).';
  END IF;

  -- Find a medication for this user
  SELECT m.name INTO v_medication_name
    FROM public.medications m
    WHERE m.user_id = v_user_id
    LIMIT 1;

  IF v_medication_name IS NULL THEN
    v_medication_name := 'Test Medication';
  END IF;

  v_schedule_time := to_char(now() AT TIME ZONE 'America/Chicago', 'HH24:MI');

  RAISE NOTICE '✅ Ready to test! User=%, Subscriptions=%, Medication=%',
    v_user_id, v_sub_count, v_medication_name;

  -- Fire the test push
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/cron-dispatch-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object(
      'schedule_id', '00000000-0000-0000-0000-000000000000',
      'user_id', v_user_id,
      'medication_name', v_medication_name,
      'medication_dosage', 'TEST DOSE',
      'schedule_time', v_schedule_time
    )
  );

  RAISE NOTICE '📤 Push request sent! Check your device in ~5 seconds.';
  RAISE NOTICE '💡 Then run: SELECT id, status_code, left(content::text, 300) AS body, created FROM net._http_response ORDER BY created DESC LIMIT 3;';
END
$$;

-- After ~5 seconds, run this to check the result:
SELECT '📬 PG_NET RESPONSE (check status_code):' AS check_name;
SELECT id, status_code,
       CASE WHEN status_code = 200 THEN '✅ Push sent successfully!'
            WHEN status_code = 401 THEN '❌ Auth failed — check service_role_key in vault'
            WHEN status_code = 404 THEN '❌ Edge Function not deployed — run: supabase functions deploy cron-dispatch-push'
            WHEN status_code = 500 THEN '❌ Edge Function error — see response body'
            WHEN status_code IS NULL THEN '⏳ Still pending (wait a few more seconds and re-run this query)'
            ELSE '⚠️ HTTP ' || status_code
       END AS meaning,
       left(content::text, 500) AS response_body,
       created
FROM net._http_response
ORDER BY created DESC
LIMIT 3;
