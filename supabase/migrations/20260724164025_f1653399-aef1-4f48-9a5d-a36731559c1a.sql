
-- Dedupe existing rows before adding the unique index
DELETE FROM public.waitlist a USING public.waitlist b
WHERE a.ctid < b.ctid AND lower(a.email) = lower(b.email);

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_lower_uniq
  ON public.waitlist ((lower(email)));

ALTER TABLE public.waitlist
  DROP CONSTRAINT IF EXISTS waitlist_email_format_chk;
ALTER TABLE public.waitlist
  ADD CONSTRAINT waitlist_email_format_chk
  CHECK (email ~* '^[A-Za-z0-9._%%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' AND length(email) <= 254);

DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.waitlist;
CREATE POLICY "Anyone can join waitlist with valid email"
  ON public.waitlist FOR INSERT TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND length(email) BETWEEN 5 AND 254
    AND email ~* '^[A-Za-z0-9._%%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );
