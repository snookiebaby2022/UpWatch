
-- helper: notify all admins
CREATE OR REPLACE FUNCTION public.notify_admins(_type text, _title text, _body text, _link text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT ur.user_id, _type, _title, _body, _link FROM public.user_roles ur WHERE ur.role = 'admin';
END;
$$;

-- support_tickets: new ticket -> notify admins
CREATE OR REPLACE FUNCTION public.on_support_ticket_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_admins(
    'ticket_new',
    'New support ticket: ' || NEW.subject,
    left(NEW.message, 200),
    '/admin'
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_support_tickets_notify AFTER INSERT ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.on_support_ticket_created();

-- support_ticket_messages: reply -> notify counterpart
CREATE OR REPLACE FUNCTION public.on_ticket_message_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ticket_owner uuid;
  ticket_subject text;
BEGIN
  SELECT user_id, subject INTO ticket_owner, ticket_subject
  FROM public.support_tickets WHERE id = NEW.ticket_id;
  IF NEW.is_admin THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (ticket_owner, 'ticket_reply', 'Support replied: ' || ticket_subject, left(NEW.body, 200), '/support');
  ELSE
    PERFORM public.notify_admins(
      'ticket_reply_user',
      'Ticket reply: ' || ticket_subject,
      left(NEW.body, 200),
      '/admin'
    );
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_ticket_messages_notify AFTER INSERT ON public.support_ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.on_ticket_message_created();

-- waitlist -> notify admins
CREATE OR REPLACE FUNCTION public.on_waitlist_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_admins(
    'waitlist_new',
    'New waitlist signup',
    NEW.email,
    '/admin'
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_waitlist_notify AFTER INSERT ON public.waitlist
FOR EACH ROW EXECUTE FUNCTION public.on_waitlist_created();

-- incidents -> notify monitor owner (opened + resolved)
CREATE OR REPLACE FUNCTION public.on_incident_opened()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m_user uuid;
  m_name text;
BEGIN
  SELECT user_id, COALESCE(name, url) INTO m_user, m_name
  FROM public.monitors WHERE id = NEW.monitor_id;
  IF m_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (m_user, 'incident_down', '🔴 ' || m_name || ' is DOWN', COALESCE(NEW.error_message, 'Monitor is not responding'), '/dashboard');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_incidents_open_notify AFTER INSERT ON public.incidents
FOR EACH ROW EXECUTE FUNCTION public.on_incident_opened();

CREATE OR REPLACE FUNCTION public.on_incident_resolved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m_user uuid;
  m_name text;
BEGIN
  IF NEW.resolved_at IS NOT NULL AND OLD.resolved_at IS NULL THEN
    SELECT user_id, COALESCE(name, url) INTO m_user, m_name
    FROM public.monitors WHERE id = NEW.monitor_id;
    IF m_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (m_user, 'incident_up', '🟢 ' || m_name || ' is back UP', 'Monitor recovered', '/dashboard');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_incidents_resolve_notify AFTER UPDATE ON public.incidents
FOR EACH ROW EXECUTE FUNCTION public.on_incident_resolved();
