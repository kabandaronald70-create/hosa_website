-- 028_campaigns.sql
-- Marketing Promotion Campaigns

CREATE TABLE IF NOT EXISTS campaigns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_businesses (
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, business_id)
);

CREATE INDEX IF NOT EXISTS campaigns_dates_idx ON campaigns (start_date, end_date);

-- Supabase Grants
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_businesses TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_businesses TO service_role;
    GRANT SELECT ON public.campaigns TO anon;
    GRANT SELECT ON public.campaign_businesses TO anon;
  END IF;
END $$;