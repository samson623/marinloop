-- ============================================================
-- marinloop Push Notification Diagnostic Script (Enhanced)
-- ============================================================
-- Run this in Supabase Dashboard → SQL Editor to diagnose why
-- push notifications are not being delivered.
--
-- Each check is numbered. Read the results top-to-bottom.
-- A failure at any step blocks all subsequent steps.
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- CHECK 1: Extensions enabled?
-- ═══════════════════════════════════════════════════════════
SELECT '1. REQUIRED EXTENSIONS' AS check_name;
SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('pg_cron', 'pg_net', 'supabase_vault')
ORDER BY extname;
-- Expected: 3 rows (pg_cron, pg_net, supabase_vault)
-- If missing: run CREATE EXTENSION IF NOT EXISTS <name>;

-- ═══════════════════════════════════════════════════════════
-- CHECK 2: Vault secrets configured?
-- ═══════════════════════════════════════════════════════════
SELECT '2. VAULT SECRETS' AS check_name;
SELECT name,
       CASE WHEN decrypted_secret IS NOT NULL AND decrypted_secret != ''
            THEN '✅ SET (' || left(decrypted_secret, 20) || '...)'
            ELSE '❌ MISSING'
       END AS status,
       CASE WHEN decrypted_secret = 'YOUR_SERVICE_ROLE_KEY_HERE'
            THEN '⚠️ STILL PLACEHOLDER — replace with real key!'
            WHEN decrypted_secret = 'REPLACE_ME_WITH_SERVICE_ROLE_KEY'
            THEN '⚠️ STILL PLACEHOLDER — replace with real key!'
            ELSE 'OK'
       END AS validity_check
FROM vault.decrypted_secrets
WHERE name IN ('supabase_url', 'service_role_key');
-- Expected: 2 rows, both ✅ SET
-- If missing: run setup-push.sql with your real values

-- ═══════════════════════════════════════════════════════════
-- CHECK 3: Cron job registered?
-- ═══════════════════════════════════════════════════════════
SELECT '3. CRON JOBS' AS check_name;
SELECT jobid, jobname, schedule, active, command
FROM cron.job
WHERE jobname LIKE 'marinloop%';
-- Expected: 2 rows (marinloop-push-dispatcher, marinloop-dispatch-log-cleanup)
-- If missing: run setup-push.sql

-- ═══════════════════════════════════════════════════════════
-- CHECK 4: Recent cron executions
-- ═══════════════════════════════════════════════════════════
SELECT '4. CRON RUN HISTORY (last 15)' AS check_name;
SELECT jobid, job_pid, status, return_message,
       start_time AT TIME ZONE 'America/Chicago' AS start_ct,
       end_time AT TIME ZONE 'America/Chicago' AS end_ct,
       (end_time - start_time) AS duration
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 15;
-- Expected: Rows with status='succeeded'
-- If status='failed': check return_message for errors

-- ═══════════════════════════════════════════════════════════
-- CHECK 5: Push subscriptions exist?
-- ═══════════════════════════════════════════════════════════
SELECT '5. PUSH SUBSCRIPTIONS' AS check_name;
SELECT user_id,
       count(*) AS subscription_count,
       max(created_at) AS latest_subscription,
       left(max(endpoint), 50) AS endpoint_preview
FROM public.push_subscriptions
GROUP BY user_id;
-- Expected: At least 1 row with subscription_count > 0
-- If empty: User hasn't enabled push notifications in the app
-- → Check VITE_VAPID_PUBLIC_KEY is set in Vercel env vars

-- ═══════════════════════════════════════════════════════════
-- CHECK 6: Active schedules
-- ═══════════════════════════════════════════════════════════
SELECT '6. ACTIVE SCHEDULES' AS check_name;
SELECT s.id AS schedule_id,
       s.user_id,
       m.name AS medication_name,
       s.time,
       s.days AS schedule_days,
       s.active,
       p.timezone,
       EXISTS (SELECT 1 FROM public.push_subscriptions ps WHERE ps.user_id = s.user_id) AS has_push
FROM public.schedules s
JOIN public.medications m ON m.id = s.medication_id
JOIN public.profiles p ON p.id = s.user_id
WHERE s.active = true
ORDER BY s.time;
-- Expected: Rows with has_push = true
-- If has_push = false: User doesn't have push subscriptions

-- ═══════════════════════════════════════════════════════════
-- CHECK 7: Time & day matching RIGHT NOW
-- ═══════════════════════════════════════════════════════════
SELECT '7. CURRENT TIME PER USER vs SCHEDULES' AS check_name;
SELECT
  p.id AS user_id,
  p.timezone,
  to_char(now() AT TIME ZONE COALESCE(p.timezone, 'America/Chicago'), 'HH24:MI') AS user_local_time,
  extract(dow FROM now() AT TIME ZONE COALESCE(p.timezone, 'America/Chicago'))::int AS user_local_dow,
  -- Show what day-of-week numbers mean
  to_char(now() AT TIME ZONE COALESCE(p.timezone, 'America/Chicago'), 'Day') AS user_local_day_name,
  now() AT TIME ZONE 'UTC' AS current_utc
FROM public.profiles p;
-- This shows what time/day the cron job sees for each user
-- Compare user_local_time with schedule.time and user_local_dow with schedule.days

-- ═══════════════════════════════════════════════════════════
-- CHECK 8: Would any schedule fire RIGHT NOW?
-- ═══════════════════════════════════════════════════════════
SELECT '8. SCHEDULES DUE RIGHT NOW' AS check_name;
SELECT
  s.id AS schedule_id,
  s.user_id,
  m.name AS medication_name,
  s.time AS schedule_time,
  s.days AS schedule_days,
  p.timezone,
  to_char(now() AT TIME ZONE COALESCE(p.timezone, 'America/Chicago'), 'HH24:MI') AS user_now,
  extract(dow FROM now() AT TIME ZONE COALESCE(p.timezone, 'America/Chicago'))::int AS user_dow,
  -- Matching analysis
  (to_char(now() AT TIME ZONE COALESCE(p.timezone, 'America/Chicago'), 'HH24:MI') = s.time) AS time_matches,
  (extract(dow FROM now() AT TIME ZONE COALESCE(p.timezone, 'America/Chicago'))::int = ANY(s.days)) AS day_matches,
  EXISTS (SELECT 1 FROM public.push_subscriptions ps WHERE ps.user_id = s.user_id) AS has_subscription
FROM public.schedules s
JOIN public.profiles p ON p.id = s.user_id
JOIN public.medications m ON m.id = s.medication_id
WHERE s.active = true
ORDER BY s.time;
-- For a notification to fire, ALL THREE must be true:
-- time_matches=true, day_matches=true, has_subscription=true

-- ═══════════════════════════════════════════════════════════
-- CHECK 9: Dispatch log (recent)
-- ═══════════════════════════════════════════════════════════
SELECT '9. DISPATCH LOG (last 20)' AS check_name;
SELECT dl.schedule_id,
       m.name AS medication_name,
       dl.minute_bucket AT TIME ZONE 'America/Chicago' AS dispatched_at_ct,
       dl.created_at
FROM public.notification_dispatch_log dl
JOIN public.schedules s ON s.id = dl.schedule_id
JOIN public.medications m ON m.id = s.medication_id
ORDER BY dl.created_at DESC
LIMIT 20;
-- If empty: the cron job has never found a due schedule
-- → Check time/day matching (Check 8)

-- ═══════════════════════════════════════════════════════════
-- CHECK 10: In-app notifications
-- ═══════════════════════════════════════════════════════════
SELECT '10. IN-APP NOTIFICATIONS (last 10)' AS check_name;
SELECT id, user_id, title, message, type, created_at
FROM public.notifications
ORDER BY created_at DESC
LIMIT 10;
-- These are created by the Edge Function AFTER push delivery
-- If dispatch log has entries but no notifications here,
-- the Edge Function call failed

-- ═══════════════════════════════════════════════════════════
-- CHECK 11: pg_net HTTP responses
-- ═══════════════════════════════════════════════════════════
SELECT '11. PG_NET RESPONSES (last 15)' AS check_name;
SELECT id, status_code,
       CASE WHEN status_code = 200 THEN '✅ OK'
            WHEN status_code = 201 THEN '✅ Created'
            WHEN status_code = 401 THEN '❌ Unauthorized (bad service_role_key in vault?)'
            WHEN status_code = 404 THEN '❌ Not Found (Edge Function not deployed?)'
            WHEN status_code = 500 THEN '❌ Server Error (check Edge Function logs)'
            WHEN status_code IS NULL THEN '⏳ Pending or network timeout'
            ELSE '⚠️ HTTP ' || status_code
       END AS meaning,
       left(content::text, 200) AS response_body,
       created
FROM net._http_response
ORDER BY created DESC
LIMIT 15;
-- This is the most revealing check!
-- status_code=404 → cron-dispatch-push not deployed
-- status_code=401 → service_role_key in vault is wrong
-- status_code=500 → Edge Function crashed (check its response body)

-- ═══════════════════════════════════════════════════════════
-- SUMMARY
-- ═══════════════════════════════════════════════════════════
SELECT '⬆️ Read the checks above in order. First failure = root cause.' AS summary;
