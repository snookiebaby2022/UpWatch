-- Backup heartbeat for Uptime Kuma push monitor (every 2 min).
-- Primary: Cloudflare Worker cron. This pg_cron job is a fallback.
SELECT cron.unschedule('upwatch-kuma-heartbeat');
SELECT cron.schedule(
  'upwatch-kuma-heartbeat',
  '*/2 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://upwatch.online/api/public/hooks/kuma-heartbeat'
  ) AS request_id;
  $$
);
