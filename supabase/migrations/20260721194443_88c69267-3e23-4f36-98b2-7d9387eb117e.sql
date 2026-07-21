
-- Extend monitors
ALTER TABLE public.monitors
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'http',
  ADD COLUMN IF NOT EXISTS keyword text,
  ADD COLUMN IF NOT EXISTS last_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;

-- check_results
CREATE TABLE IF NOT EXISTS public.check_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id uuid NOT NULL REFERENCES public.monitors(id) ON DELETE CASCADE,
  status text NOT NULL,
  response_time_ms integer,
  status_code integer,
  error_message text,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS check_results_monitor_time_idx ON public.check_results (monitor_id, checked_at DESC);

GRANT SELECT ON public.check_results TO authenticated;
GRANT ALL ON public.check_results TO service_role;
ALTER TABLE public.check_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own check results" ON public.check_results
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.monitors m WHERE m.id = check_results.monitor_id AND m.user_id = auth.uid()));

-- subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  plan text NOT NULL DEFAULT 'starter',
  status text NOT NULL DEFAULT 'active',
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
