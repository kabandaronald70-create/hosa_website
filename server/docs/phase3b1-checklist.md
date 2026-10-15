# Phase 3B-1 — Avatar upload checklist

## Setup

- Supabase project exists, private bucket `avatars` created
- `server/.env` has `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `npm install` completed in `server/`
- `npm run dev` starts cleanly

## Upload

1. Log in. Go to `/dashboard/profile`.
2. See "No photo yet."
3. Upload a small JPEG (< 2 MB). Submit the avatar form.
4. Redirect back to `/dashboard/profile` with "Avatar updated."
5. Photo appears at `/dashboard/avatar/me` (server redirects to a signed URL).
6. Confirm in Supabase Storage → `avatars` bucket → see `{userId}/{uuid}.jpg`.

## Replace

7. Upload a different image. The old one should be removed from Storage.
   Verify in Supabase dashboard: only the new file remains.

## Delete

8. Click "Remove current photo." Redirect with "Avatar removed."
9. Photo disappears. Storage is empty for this user.

## Validation

10. Try uploading a `.txt` file renamed to `.jpg` → "File is not a valid JPEG, PNG, or WebP image."
11. Try uploading a > 2 MB image → "File is too large."
12. Try uploading an SVG (allowed mimetype but not in our list) → rejected.

## Ownership

13. Log in as user A. Get user B's UUID.
14. Visit `/dashboard/avatar/{B-uuid}`. If B has `public_visibility = true`, you get a signed-URL redirect. If false, 404.
15. Confirm you **cannot** POST to `/dashboard/avatar` on behalf of user B — there's no `user_id` field in the form; the controller always uses `req.user.id`.

## Database

16. `SELECT avatar_path FROM member_profiles WHERE user_id = '...';` returns `{uuid}/{uuid}.ext` after upload.
17. After delete, it returns NULL.

## Security

18. Signed URL from step 5 expires after 60 seconds. Refresh after waiting → image 404s from Supabase, but the `/dashboard/avatar/me` route issues a fresh one.
19. Open DevTools → Network. Confirm no Supabase service-role key ever appears in a browser request or response.
