-- ============================================================
-- MedFlow Push Notification Diagnostic Script
-- ============================================================
-- Run this in Supabase Dashboard → SQL Editor to diagnose why
-- push notifications are not being delivered.
-- ============================================================

-- 1. CHECK: Do Vault secrets exist?
-- If either row is missing, the cron dispatcher silently aborts.
SELECT '1. VAULT SECRETS' AS check_name;
SELECT name, 
       CASE WHEN decrypted_secret IS NOT NULL AND decrypted_secret != '' 
            THEN '✅ SET (' || left(decrypted_secret, 12) || '...)' 
            ELSE '❌ MISSING' 
       END AS status
FROM vault.decrypted_secrets
WHERE name IN ('supabase_url', 'service_role_key');

-- If no rows returned, secrets are NOT configured. Fix:
-- select vault.create_secret('https://<your-project>.supabase.co', 'supabase_url', 'Supabase URL for Cron');
-- select vault.create_secret('<your-service-role-key>', 'service_role_key', 'Service Role Key for Cron');

-- 2. CHECK: Is the cron job registered?
SELECT '2. CRON JOBS' AS check_name;
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname LIKE 'medflow%';

-- 3. CHECK: Recent cron job execution history
SELECT '3. CRON RUN HISTORY (last 10)' AS check_name;
SELECT jobid, job_pid, status, return_message, 
       start_time AT TIME ZONE 'America/Chicago' AS start_time_ct,
       end_time AT TIME ZONE 'America/Chicago' AS end_time_ct
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;

-- 4. CHECK: Are there any push subscriptions for any user?
SELECT '4. PUSH SUBSCRIPTIONS' AS check_name;
SELECT user_id, 
       count(*) AS subscription_count,
       max(created_at) AS latest_subscription
FROM public.push_subscriptions
GROUP BY user_id;

-- 5. CHECK: Active schedules with times
SELECT '5. ACTIVE SCHEDULES' AS check_name;
SELECT s.id AS schedule_id,
       s.user_id,
       m.name AS medication_name,
       s.time,
       s.days,
       s.active,
       p.timezone
FROM public.schedules s
JOIN public.medications m ON m.id = s.medication_id
JOIN public.profiles p ON p.id = s.user_id
WHERE s.active = true
ORDER BY s.time;

-- 6. CHECK: What time is it right now in each user's timezone?
SELECT '6. CURRENT TIME PER USER' AS check_name;
SELECT p.id AS user_id,
       p.timezone,
       to_char(now() AT TIME ZONE p.timezone, 'HH24:MI') AS current_hhmm,
       extract(dow FROM now() AT TIME ZONE p.timezone)::int AS current_dow
FROM public.profiles p;

-- 7. CHECK: Recent dispatch log entries
SELECT '7. DISPATCH LOG (last 20)' AS check_name;
SELECT dl.schedule_id,
       m.name AS medication_name,
       dl.minute_bucket AT TIME ZONE 'America/Chicago' AS dispatched_at_ct,
       dl.created_at
FROM public.notification_dispatch_log dl
JOIN public.schedules s ON s.id = dl.schedule_id
JOIN public.medications m ON m.id = s.medication_id
ORDER BY dl.created_at DESC
LIMIT 20;

-- 8. CHECK: Recent in-app notifications (created by the dispatcher)
SELECT '8. IN-APP NOTIFICATIONS (last 10)' AS check_name;
SELECT id, user_id, title, message, type, created_at
FROM public.notifications
ORDER BY created_at DESC
LIMIT 10;

-- 9. CHECK: pg_net responses (HTTP requests made by cron)
SELECT '9. PG_NET RESPONSES (last 10)' AS check_name;
SELECT id, status_code, content, created
FROM net._http_response
ORDER BY created DESC
LIMIT 10;
