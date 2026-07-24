
-- Point the monitor runner cron at production (was still calling the old Lovable preview URL).
SELECT cron.unschedule('upwatch-run-monitors');
SELECT cron.schedule(
  'upwatch-run-monitors',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://upwatch.online/api/public/hooks/run-monitors',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_DN7TI6X612A8S8FwSLw2qA_PEQTMHHW"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
