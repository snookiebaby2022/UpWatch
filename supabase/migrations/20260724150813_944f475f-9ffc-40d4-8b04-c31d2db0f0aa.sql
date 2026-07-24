ALTER TABLE public.monitors
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS monitors_public_idx
  ON public.monitors (is_public, is_active)
  WHERE is_public AND is_active;

GRANT SELECT ON public.monitors TO anon;
GRANT SELECT ON public.check_results TO anon;

DROP POLICY IF EXISTS "Public monitors are viewable" ON public.monitors;
CREATE POLICY "Public monitors are viewable"
  ON public.monitors
  FOR SELECT
  TO anon, authenticated
  USING (is_public = true AND is_active = true);

DROP POLICY IF EXISTS "Public check_results are viewable" ON public.check_results;
CREATE POLICY "Public check_results are viewable"
  ON public.check_results
  FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.monitors m
    WHERE m.id = check_results.monitor_id
      AND m.is_public = true
      AND m.is_active = true
  ));