-- UpWatch support ticket system — paste ALL of this in Supabase SQL Editor and Run once.
-- Run fix-admin-now.sql first (needs public.has_role).
-- https://supabase.com/dashboard/project/vepgivwmulpdacsfucmn/sql/new

DO $$ BEGIN
  CREATE TYPE public.ticket_priority AS ENUM ('low', 'normal', 'high');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_status AS ENUM ('open', 'pending', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS support_tickets_created_at_idx ON public.support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_id_idx
  ON public.support_ticket_messages(ticket_id, created_at);

DROP TRIGGER IF EXISTS support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

SELECT 'support_tickets ready' AS status, count(*) AS ticket_count FROM public.support_tickets;
