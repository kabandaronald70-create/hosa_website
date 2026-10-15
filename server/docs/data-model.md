# HOSA Data Model (Phase 1)

## Tables

### `users`

Authentication + minimal identity. Never exposed to public reads.

- `id` UUID PK
- `email` (as entered)
- `email_normalized` (lowercased/trimmed; UNIQUE)
- `password_hash` (argon2id, Phase 2)
- `email_verified_at`, `status`, `created_at`, `updated_at`, `last_login_at`

### `roles`

Fixed vocabulary: `member`, `mentor`, `moderator`, `admin`, `super_admin`.

### `user_roles`

Join table. PK `(user_id, role_id)`. Role IDs are never accepted from a user-facing form.

### `member_profiles`

Public/private profile data. 1:1 with `users`.

## Indexes

Directory filters: `graduation_year`, `district`, `profession`, `public_visibility`.
Mentor list: partial index on `mentor_opt_in = TRUE`.

## Future migrations

events, event_rsvps, opportunities, opportunity_categories, stories,
mentorship_requests, mentor_profiles, saved_items, notifications,
announcements, reports, audit_logs, password_reset_tokens, email_verification_tokens.
