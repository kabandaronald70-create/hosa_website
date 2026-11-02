-- 033_notification_types.sql
-- Update the notifications type constraint to include financial notifications

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'story.approved', 
  'story.rejected',
  'opportunity.approved', 
  'opportunity.rejected',
  'mentorship.accepted', 
  'mentorship.declined',
  'finance.expense_pending', 
  'finance.expense_rejected'
));

-- Supabase Grants (safe to run)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;
  END IF;
END $$;