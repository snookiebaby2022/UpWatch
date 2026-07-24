-- Ensure monitors table has all columns the app expects (safe to re-run).
ALTER TABLE public.monitors
  ADD COLUMN IF NOT EXISTS interval_seconds integer NOT NULL DEFAULT 900,
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'http',
  ADD COLUMN IF NOT EXISTS keyword text,
  ADD COLUMN IF NOT EXISTS last_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- Align stored intervals with active subscription plans.
UPDATE public.monitors m
SET interval_seconds = CASE COALESCE(s.plan, 'starter')
  WHEN 'business' THEN 60
  WHEN 'pro' THEN 300
  ELSE 900
END
FROM public.subscriptions s
WHERE s.user_id = m.user_id
  AND s.status = 'active'
  AND m.interval_seconds <> CASE COALESCE(s.plan, 'starter')
    WHEN 'business' THEN 60
    WHEN 'pro' THEN 300
    ELSE 900
  END;

UPDATE public.monitors
SET interval_seconds = 900
WHERE interval_seconds IS NULL OR interval_seconds NOT IN (60, 300, 900);
