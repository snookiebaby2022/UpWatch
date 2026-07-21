CREATE TABLE public.waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT INSERT ON public.waitlist TO anon, authenticated;
GRANT ALL ON public.waitlist TO service_role;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can join waitlist" ON public.waitlist FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins can view waitlist" ON public.waitlist FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));