UPDATE public.monitors m
SET interval_seconds = CASE COALESCE(s.plan, 'starter')
  WHEN 'business' THEN 60
  WHEN 'pro' THEN 300
  ELSE 900
END
FROM (SELECT user_id, plan FROM public.subscriptions) s
WHERE s.user_id = m.user_id
  AND m.interval_seconds <> CASE s.plan WHEN 'business' THEN 60 WHEN 'pro' THEN 300 ELSE 900 END;

UPDATE public.monitors
SET interval_seconds = 900
WHERE interval_seconds <> 900
  AND user_id NOT IN (SELECT user_id FROM public.subscriptions);