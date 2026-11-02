-- 030_financials.sql
-- Financial Management Module

-- 1. Contributions (Income)
CREATE TABLE IF NOT EXISTS contributions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL, -- Null for anonymous/external donors
  amount          NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency        TEXT NOT NULL DEFAULT 'UGX',
  purpose         TEXT NOT NULL, -- e.g., 'Annual Subscription', 'Library Project'
  payment_method  TEXT NOT NULL, -- e.g., 'Mobile Money', 'Bank Transfer', 'Cash'
  reference       TEXT,          -- Transaction ID / Receipt Number
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  verified_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contributions_status_idx ON contributions (status);
CREATE INDEX IF NOT EXISTS contributions_user_idx ON contributions (user_id);

-- 2. Expenses (Outgoings)
CREATE TABLE IF NOT EXISTS expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  amount          NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency        TEXT NOT NULL DEFAULT 'UGX',
  category        TEXT NOT NULL, -- e.g., 'Administration', 'Event', 'Project'
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  requested_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expenses_status_idx ON expenses (status);

-- 3. Supabase Grants
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.contributions TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.contributions TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO service_role;
    GRANT SELECT ON public.contributions TO anon; -- So members can see aggregate totals
  END IF;
END $$;