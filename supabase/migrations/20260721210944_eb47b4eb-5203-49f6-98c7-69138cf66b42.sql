CREATE INDEX IF NOT EXISTS monitors_user_id_idx ON public.monitors (user_id);
CREATE INDEX IF NOT EXISTS incidents_started_at_idx ON public.incidents (started_at DESC);
CREATE INDEX IF NOT EXISTS waitlist_created_at_idx ON public.waitlist (created_at DESC);
CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON public.profiles (created_at DESC);