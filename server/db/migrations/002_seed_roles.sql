-- 002_seed_roles.sql
INSERT INTO roles (name, description) VALUES
  ('member',      'Registered alumni; can edit own profile, RSVP, submit content.'),
  ('mentor',      'Member who opted in to receive mentorship requests.'),
  ('moderator',   'Reviews and approves member-submitted stories and opportunities.'),
  ('admin',       'Manages members, events, content, and site settings.'),
  ('super_admin', 'Manages admin assignments and high-impact system config.')
ON CONFLICT (name) DO NOTHING;