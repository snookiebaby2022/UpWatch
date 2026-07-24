
-- 1) One open incident per monitor (idempotency for the runner)
CREATE UNIQUE INDEX IF NOT EXISTS incidents_one_open_per_monitor
  ON public.incidents (monitor_id)
  WHERE resolved_at IS NULL;

-- 2) Server-side priority derivation for support tickets
CREATE OR REPLACE FUNCTION public.set_ticket_priority_from_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_plan text;
BEGIN
  SELECT plan INTO user_plan
  FROM public.subscriptions
  WHERE user_id = NEW.user_id
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF user_plan = 'business' THEN
    NEW.priority := 'high'::ticket_priority;
  ELSIF user_plan = 'pro' THEN
    NEW.priority := 'normal'::ticket_priority;
  ELSE
    NEW.priority := 'low'::ticket_priority;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_ticket_priority ON public.support_tickets;
CREATE TRIGGER trg_set_ticket_priority
BEFORE INSERT ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.set_ticket_priority_from_plan();

-- 3) Defense-in-depth: reject non-https webhook targets at the DB layer
CREATE OR REPLACE FUNCTION public.validate_notification_channel()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.type IN ('slack', 'discord', 'webhook') THEN
    IF NEW.target !~* '^https://' THEN
      RAISE EXCEPTION 'Webhook target must be an https:// URL';
    END IF;
  ELSIF NEW.type = 'email' THEN
    IF NEW.target !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
      RAISE EXCEPTION 'Invalid email address';
    END IF;
  ELSIF NEW.type = 'telegram' THEN
    IF NEW.target !~ '^-?[0-9]+$' THEN
      RAISE EXCEPTION 'Telegram chat_id must be numeric';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_notification_channel ON public.notification_channels;
CREATE TRIGGER trg_validate_notification_channel
BEFORE INSERT OR UPDATE ON public.notification_channels
FOR EACH ROW EXECUTE FUNCTION public.validate_notification_channel();
