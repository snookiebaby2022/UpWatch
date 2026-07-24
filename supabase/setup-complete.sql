-- UpWatch one-shot setup: run entire file in Supabase SQL editor.
-- Safe to re-run (uses IF NOT EXISTS / duplicate_object guards).

-- 1) Role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) Core tables (minimal bootstrap if migrations were never applied)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'starter',
  status TEXT NOT NULL DEFAULT 'active',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) has_role helper
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role::text = _role::text
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

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

-- 4) Admin panel policies (only if tables exist)
DO $$ BEGIN
  IF to_regclass('public.notification_channels') IS NOT NULL THEN
    CREATE POLICY "Admins view all notification_channels"
      ON public.notification_channels FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public.monitors') IS NOT NULL THEN
    CREATE POLICY "Admins update monitors"
      ON public.monitors FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public.incidents') IS NOT NULL THEN
    CREATE POLICY "Admins update incidents"
      ON public.incidents FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public.waitlist') IS NOT NULL THEN
    CREATE POLICY "Admins delete waitlist"
      ON public.waitlist FOR DELETE TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5) Admin user emails RPC
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE (user_id uuid, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY SELECT u.id, u.email::text FROM auth.users u;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_users() TO authenticated;

-- 6) Grant yourself admin (change email if needed)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE lower(email) = lower('snookiebaby2022@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- 7) Backfill profiles for existing auth users
INSERT INTO public.profiles (id, display_name)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 8) Default subscription rows
INSERT INTO public.subscriptions (user_id, plan, status)
SELECT u.id, 'starter', 'active'
FROM auth.users u
LEFT JOIN public.subscriptions s ON s.user_id = u.id
WHERE s.user_id IS NULL;

-- 9) Fix monitor runner cron (was calling old lovable.app preview URL)
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

-- 10) Ensure monitors columns exist (fixes "interval_seconds not in schema cache")
ALTER TABLE public.monitors
  ADD COLUMN IF NOT EXISTS interval_seconds integer NOT NULL DEFAULT 900,
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'http',
  ADD COLUMN IF NOT EXISTS keyword text,
  ADD COLUMN IF NOT EXISTS last_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
