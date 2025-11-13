CREATE TABLE IF NOT EXISTS public.customers (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  tier TEXT NOT NULL,
  suspended_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.customer_tiers (
  tier TEXT PRIMARY KEY,
  monthly_quota INTEGER NOT NULL,
  priority_level TEXT NOT NULL,
  escalation_sla_hours INTEGER NOT NULL
);

INSERT INTO public.customers (email, display_name, tier, suspended_at)
VALUES
  ('physical@example.com', 'Physical Customer', 'standard', NULL),
  ('secondary@example.com', 'Secondary Customer', 'standard', NOW() - INTERVAL '30 days');

INSERT INTO public.customer_tiers (tier, monthly_quota, priority_level, escalation_sla_hours)
VALUES
  ('standard', 100, 'silver', 24),
  ('enterprise', 1000, 'gold', 1);
