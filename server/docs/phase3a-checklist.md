# Phase 3A — Manual test checklist

## Setup

- `npm run migrate` shows `004_profile_extras.sql` applied.
- `npm run dev` starts cleanly.

## Profile edit

1. Log in as `test1@example.com`.
2. Go to `/dashboard`. Completion shows a percentage and missing fields.
3. Click **Edit profile**.
4. Change biography to at least 40 chars; set profession, district, country code `UG`.
5. Save → redirected to `/dashboard` with a green "Profile updated." flash.
6. Completion percentage should have increased.

## Privacy toggles

7. Uncheck **Show my profile in the public directory**, save.
8. In psql:
   `SELECT public_visibility FROM member_profiles WHERE user_id = (SELECT id FROM users WHERE email='test1@example.com');`
   Should return `f`.

## Mentor role sync

9. Check **I'm willing to mentor current students**, save.
10. psql:
    `SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = (SELECT id FROM users WHERE email='test1@example.com');`
    Should include `member` and `mentor`.
11. Uncheck, save. Should be back to only `member`.

## Password change

12. Go to `/dashboard/password`.
13. Enter a **wrong** current password → field-level error, page reloads.
14. Enter current password, new password `longpassword123`, confirm same → redirected to `/dashboard` with "Password changed."
15. Log out. Log back in with the **new** password. Works.
16. Log in with the **old** password. Fails with generic error.

## Ownership check

17. While logged in as user A, use psql to find user B's `user_id`.
18. (Manual) Edit your own profile twice. Confirm only your row changes:
    `SELECT user_id, updated_at FROM member_profiles ORDER BY updated_at DESC LIMIT 5;`
    Only your `user_id` should have a fresh `updated_at`.
