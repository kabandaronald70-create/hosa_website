# Phase 7 — SPA integration checklist

## Setup

- [ ] `server/` run `npm run dev` (backend on :3000)
- [ ] repo root run `npm run dev` (Vite on :5173) OR `npm run build` + serve from :3000
- [ ] Log in at `/login` (backend) — the SPA at `:5173/#/...` shares the cookie? Only in same-origin. If dev proxy is set up, it works. Otherwise, log in at `:3000/login` and use `:3000/` for the SPA.

## /api/me

- [ ] Logged out: `curl http://localhost:3000/api/me` → `{ user: null }`
- [ ] Logged in: `curl http://localhost:3000/api/me` (with cookie) → `{ user: { id, email, roles } }`

## Save from SPA

- [ ] Visit `/api/me/saved` while logged in → returns list (may be empty)
- [ ] Open `#/directory` in the SPA
- [ ] Click "Save to favourites" on a member — if not logged in, redirect to `/login`
- [ ] Log in. Return to `#/directory`. Click "Save".
- [ ] `/api/me/saved` now includes the item
- [ ] The button should reflect the saved state (needs SPA code to check — see step 9)

## RSVP from SPA

- [ ] Same flow for `#/events` — click RSVP
- [ ] `/api/me/rsvps` includes the slug
- [ ] Confirm in EJS at `/dashboard` — "My upcoming RSVPs" shows the event

## Mentorship from SPA

- [ ] Open a member profile at `#/member/m001`
- [ ] If the member is a mentor, click "Request mentorship" → goes to `/dashboard/mentorship/requests/new?mentor=m001's-uuid`
- [ ] Form works, submits, redirects to `/dashboard/mentorship/requests`

## Regression

- [ ] `/api/directory`, `/api/events`, `/api/stories` still work without auth
- [ ] SPA navigation (`#/directory` → `#/member/m001` → `#/events`) still works
- [ ] No console errors when logged out
