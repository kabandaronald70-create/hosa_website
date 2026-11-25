-- Track when an expense request is last edited.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
