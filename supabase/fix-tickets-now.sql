-- UpWatch support tickets — safe to re-run.
-- https://supabase.com/dashboard/project/zjijihumvmijnijpkwpz/sql/new
-- Creates messages table + priority column (required for admin replies and priority badges).

-- 0) Enums
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_priority AS ENUM ('low', 'normal', 'high');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_status AS ENUM ('open', 'pending', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1) has_role (single app_role version — required for admin ticket policies)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

-- 2) Tickets table (may already exist without priority / messages)
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  message text NOT NULL,
  priority public.ticket_priority NOT NULL DEFAULT 'normal',
  status public.ticket_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS priority public.ticket_priority NOT NULL DEFAULT 'normal';

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 3) Messages table (missing in production — blocks admin replies)
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT SELECT, INSERT ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
GRANT ALL ON public.support_ticket_messages TO service_role;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- 4) RLS — tickets
DROP POLICY IF EXISTS "Users view own tickets" ON public.support_tickets;
CREATE POLICY "Users view own tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users create own tickets" ON public.support_tickets;
CREATE POLICY "Users create own tickets" ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all tickets" ON public.support_tickets;
CREATE POLICY "Admins view all tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins update tickets" ON public.support_tickets;
CREATE POLICY "Admins update tickets" ON public.support_tickets
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 5) RLS — messages
DROP POLICY IF EXISTS "Users view own ticket messages" ON public.support_ticket_messages;
CREATE POLICY "Users view own ticket messages" ON public.support_ticket_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins view all ticket messages" ON public.support_ticket_messages;
CREATE POLICY "Admins view all ticket messages" ON public.support_ticket_messages
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users reply to own tickets" ON public.support_ticket_messages;
CREATE POLICY "Users reply to own tickets" ON public.support_ticket_messages
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid()
    AND is_admin = false
    AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins reply to any ticket" ON public.support_ticket_messages;
CREATE POLICY "Admins reply to any ticket" ON public.support_ticket_messages
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid()
    AND is_admin = true
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS support_tickets_priority_idx ON public.support_tickets(priority);
CREATE INDEX IF NOT EXISTS support_tickets_created_at_idx ON public.support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_id_idx
  ON public.support_ticket_messages(ticket_id, created_at);

-- 6) Auto priority from plan on new tickets
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
  WHERE user_id = NEW.user_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF user_plan = 'business' THEN
    NEW.priority := 'high'::public.ticket_priority;
  ELSIF user_plan = 'pro' THEN
    NEW.priority := 'normal'::public.ticket_priority;
  ELSE
    NEW.priority := 'low'::public.ticket_priority;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_ticket_priority ON public.support_tickets;
CREATE TRIGGER trg_set_ticket_priority
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_ticket_priority_from_plan();

-- 7) Backfill priority on existing tickets
UPDATE public.support_tickets t
SET priority = CASE s.plan
  WHEN 'business' THEN 'high'::public.ticket_priority
  WHEN 'pro' THEN 'normal'::public.ticket_priority
  ELSE 'low'::public.ticket_priority
END
FROM public.subscriptions s
WHERE s.user_id = t.user_id AND s.status = 'active'
  AND t.priority = 'normal'::public.ticket_priority;

-- 8) Realtime
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'support_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'support_ticket_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_ticket_messages;
  END IF;
END $$;

ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;
ALTER TABLE public.support_ticket_messages REPLICA IDENTITY FULL;

-- 9) Notifications (required for customer alerts on admin replies)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all notifications" ON public.notifications;
CREATE POLICY "Admins view all notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users mark own notifications read" ON public.notifications;
CREATE POLICY "Users mark own notifications read" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications(user_id) WHERE read = false;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 10) Verify
SELECT id, subject, priority, status, created_at FROM public.support_tickets ORDER BY created_at DESC LIMIT 5;
