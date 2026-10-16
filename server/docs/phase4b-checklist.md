# Phase 4B — Members management checklist

## Setup

- [ ] `npm run dev` starts cleanly
- [ ] Log in as an admin (test1@example.com)

## List

- [ ] /admin/members shows 16 members
- [ ] Search "sarah" → 1 result
- [ ] Filter role=admin → only your account
- [ ] Filter verified=no → all members (nobody verified yet)
- [ ] Filter verified=yes → 0 members
- [ ] Filter status=suspended → 0 members
- [ ] Pagination controls appear if >25 members (probably not yet)

## Detail

- [ ] Click "Open" next to any member → detail page
- [ ] All fields render

## Actions

- [ ] Verify a member → flash "Verified …"
- [ ] Reload → "Verified" timestamp visible
- [ ] /admin shows "1 verified" stat
- [ ] /admin → Recent admin actions → "member.verify" row for your account
- [ ] Unverify → audit shows "member.unverify"
- [ ] Suspend a member → status becomes "suspended"
- [ ] Log in as that member → login fails with "This account is not active."
- [ ] Reactivate → login works again
- [ ] Try to suspend your own account → error flash, no change

## Regression

- [ ] /admin still shows correct counts
- [ ] SPA still works: /, #/directory, #/events
