
CREATE TABLE public.monitors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  interval_seconds integer NOT NULL DEFAULT 300,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitors TO authenticated;
GRANT ALL ON public.monitors TO service_role;

ALTER TABLE public.monitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own monitors" ON public.monitors
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER monitors_set_updated_at
  BEFORE UPDATE ON public.monitors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
