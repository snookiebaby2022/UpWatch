-- UpWatch admin fix — safe to re-run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/zjijihumvmijnijpkwpz/sql/new

-- 1) Role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) Roles table (required before has_role / admin grant)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users view own roles"
    ON public.user_roles FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- 3) has_role helper (must exist before GRANT below)
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

-- 4) Self-service bootstrap when signed in as owner email
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

-- 5) Grant admin to your account (no-op if user not created yet)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE lower(email) = lower('snookiebaby2022@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- 6) Verify auth account exists
SELECT
  u.id,
  u.email,
  u.email_confirmed_at,
  u.last_sign_in_at,
  COALESCE(u.raw_app_meta_data->>'provider', 'email') AS sign_in_provider
FROM auth.users u
WHERE lower(u.email) = lower('snookiebaby2022@gmail.com');

-- 7) Verify admin role
SELECT u.email, ur.role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE lower(u.email) = lower('snookiebaby2022@gmail.com');

-- If step 6 returns NO ROWS, create the login first:
--   Dashboard → Authentication → Users → Add user
--   Email: snookiebaby2022@gmail.com, password 8+ chars, tick Auto Confirm User
-- Then re-run the INSERT in section 5, or sign in and visit /admin (bootstrap_admin runs automatically).
