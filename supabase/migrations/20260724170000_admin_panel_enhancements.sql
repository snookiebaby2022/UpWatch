
-- Admin panel: missing RLS policies + user email RPC

CREATE POLICY "Admins view all notification_channels"
  ON public.notification_channels
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update monitors"
  ON public.monitors
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update incidents"
  ON public.incidents
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete waitlist"
  ON public.waitlist
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Return user id + email for admin console (auth.users is not exposed via PostgREST)
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

  RETURN QUERY
  SELECT u.id, u.email::text
  FROM auth.users u;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_users() TO authenticated;
