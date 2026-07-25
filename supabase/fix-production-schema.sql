-- Fix has_role overload, recreate admin RLS policies, migrate last_status, grant admin.
-- Safe to re-run. Skips policies for tables that do not exist yet.
-- https://supabase.com/dashboard/project/zjijihumvmijnijpkwpz/sql/new

-- 0) Role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1) Canonical has_role (app_role only)
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

-- 2) Drop legacy text overload (+ policies/functions that depended on it)
DROP FUNCTION IF EXISTS public.has_role(uuid, text) CASCADE;

-- 3) Recreate admin policies only on tables that exist
DO $$
BEGIN
  IF to_regclass('public.monitors') IS NOT NULL THEN
    BEGIN
      CREATE POLICY "Admins view all monitors" ON public.monitors
        FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::public.app_role));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      CREATE POLICY "Admins update monitors" ON public.monitors
        FOR UPDATE TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::public.app_role))
        WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    BEGIN
      CREATE POLICY "Admins view all profiles" ON public.profiles
        FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::public.app_role));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;

  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    BEGIN
      CREATE POLICY "Admins view all subscriptions" ON public.subscriptions
        FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::public.app_role));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      CREATE POLICY "Admins insert subscriptions" ON public.subscriptions
        FOR INSERT TO authenticated
        WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      CREATE POLICY "Admins update subscriptions" ON public.subscriptions
        FOR UPDATE TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::public.app_role))
        WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;

  IF to_regclass('public.check_results') IS NOT NULL THEN
    BEGIN
      CREATE POLICY "Admins view all check_results" ON public.check_results
        FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::public.app_role));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;

  IF to_regclass('public.incidents') IS NOT NULL THEN
    BEGIN
      CREATE POLICY "Admins view all incidents" ON public.incidents
        FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::public.app_role));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      CREATE POLICY "Admins update incidents" ON public.incidents
        FOR UPDATE TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::public.app_role))
        WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;

  IF to_regclass('public.waitlist') IS NOT NULL THEN
    BEGIN
      CREATE POLICY "Admins view all waitlist" ON public.waitlist
        FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::public.app_role));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      CREATE POLICY "Admins can view waitlist" ON public.waitlist
        FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::public.app_role));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      CREATE POLICY "Admins delete waitlist" ON public.waitlist
        FOR DELETE TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::public.app_role));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;

  IF to_regclass('public.user_roles') IS NOT NULL THEN
    BEGIN
      CREATE POLICY "Admins view all user_roles" ON public.user_roles
        FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::public.app_role));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      CREATE POLICY "Admins manage user_roles" ON public.user_roles
        FOR ALL TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::public.app_role))
        WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;

  IF to_regclass('public.notification_channels') IS NOT NULL THEN
    BEGIN
      CREATE POLICY "Admins view all notification_channels" ON public.notification_channels
        FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::public.app_role));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;

  IF to_regclass('public.support_tickets') IS NOT NULL THEN
    BEGIN
      CREATE POLICY "Admins view all tickets" ON public.support_tickets
        FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::public.app_role));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      CREATE POLICY "Admins update tickets" ON public.support_tickets
        FOR UPDATE TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::public.app_role))
        WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;

  IF to_regclass('public.support_ticket_messages') IS NOT NULL THEN
    BEGIN
      CREATE POLICY "Admins view all ticket messages" ON public.support_ticket_messages
        FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::public.app_role));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      CREATE POLICY "Admins reply to any ticket" ON public.support_ticket_messages
        FOR INSERT TO authenticated
        WITH CHECK (
          author_id = auth.uid()
          AND public.has_role(auth.uid(), 'admin'::public.app_role)
        );
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    BEGIN
      CREATE POLICY "Admins view all notifications" ON public.notifications
        FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::public.app_role));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE (user_id uuid, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email::text
  FROM auth.users u;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.bootstrap_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  IF _email IS NULL OR lower(_email) <> lower('snookiebaby2022@gmail.com') THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_admin() TO authenticated;

-- 4) last_status: integer (0/1/2) → text (pending/up/down)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'monitors'
      AND column_name = 'last_status'
      AND udt_name IN ('int4', 'int2', 'int8')
  ) THEN
    ALTER TABLE public.monitors ALTER COLUMN last_status DROP DEFAULT;
    ALTER TABLE public.monitors
      ALTER COLUMN last_status TYPE text
      USING (
        CASE last_status
          WHEN 0 THEN 'pending'
          WHEN 1 THEN 'up'
          WHEN 2 THEN 'down'
          ELSE 'pending'
        END
      );
    ALTER TABLE public.monitors ALTER COLUMN last_status SET DEFAULT 'pending';
    ALTER TABLE public.monitors ALTER COLUMN last_status SET NOT NULL;
  END IF;
END $$;

-- 5) Admin only for owner account (not test customer accounts)
DELETE FROM public.user_roles
WHERE role = 'admin'
  AND user_id IN (
    SELECT id FROM auth.users
    WHERE lower(email) <> lower('snookiebaby2022@gmail.com')
  );

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE lower(email) = lower('snookiebaby2022@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- 6) Normalize bad status values
UPDATE public.monitors
SET last_status = 'pending'
WHERE last_status IS NULL OR last_status NOT IN ('pending', 'up', 'down');

-- 7) Verify
SELECT u.email, ur.role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE lower(u.email) = lower('snookiebaby2022@gmail.com');
