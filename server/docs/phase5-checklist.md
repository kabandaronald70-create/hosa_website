# Phase 5 — Submission workflow checklist

## Setup

- [ ] Local: `npm run migrate` applied `010_submission_metadata.sql`
- [ ] Supabase: `npm run migrate` applied `010_submission_metadata.sql`
- [ ] Local: `npm run dev` starts
- [ ] Log in as a regular member (not admin)

## Story submission

- [ ] /dashboard shows the "Contribute" section
- [ ] Click "Submit an alumni story" → form loads
- [ ] Submit with title < 5 chars → field error
- [ ] Submit with body < 50 chars → field error
- [ ] Submit valid story → flash "Story submitted for review." → redirect to /dashboard/submissions
- [ ] Story shows with status "pending"
- [ ] /api/stories does NOT include the story yet

## Opportunity submission

- [ ] /dashboard/opportunities/new → form loads
- [ ] Invalid URL in application_url → field error
- [ ] Submit valid opportunity → flash + listed in /dashboard/submissions

## Moderation

- [ ] Log in as admin
- [ ] /admin shows pending counts increased
- [ ] /admin/moderation lists the new story + opportunity
- [ ] Approve the story → status becomes "published"
- [ ] Log out, log in as the member → /dashboard/submissions shows "published"
- [ ] /api/stories now includes it

## Rejection

- [ ] As member, submit another story
- [ ] As admin, reject with reason "Test rejection reason"
- [ ] As member, /dashboard/submissions shows the reason under Notes

## Regression

- [ ] Seed stories still visible in /api/stories
- [ ] SPA still loads
- [ ] Directory still works
- [ ] Admin dashboard still works
