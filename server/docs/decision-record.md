# Architecture Decision Record — HOSA Unified UI

**Date:** 2026-10-18
**Author:** Kabanda Ronald
**Status:** Accepted

## Decision

Follow the Unified Modification Guide's Phase 0 with a **hybrid implementation (Path B-Hybrid)**.

- **Keep:** the existing Vite SPA for Home, Directory, Events, Jobs, Stories.
- **Add:** new EJS pages for About, Privacy, Terms, Help, Contact, Mentorship info, 404/500, Announcements, Archive, Super Admin.
- **Unify:** one design system (color tokens, typography, components) applied to both the SPA and the EJS pages so they look identical.
- **Migrate incrementally:** if any SPA page becomes a bottleneck later, port it to EJS individually. No full rewrite.

## Context

The Unified Modification Guide (Oct 2026) was written assuming Path B (full EJS rewrite). The current codebase, however, has a working Vite SPA with:

- 5 fully functional public pages (Home, Directory, Events, Jobs, Stories)
- Working `/api/*` endpoints
- 16 members, 6 events, 5 opportunities, 5 stories in production
- Deployed on Render with Supabase Postgres + Storage

A full rewrite would discard ~1500 lines of working frontend code and take 4–6 weeks.

## Rationale

1. **Zero user-facing difference.** A hybrid delivers the same UX as a full rewrite.
2. **Preserves working investment.** Rewrites introduce bugs; the SPA is tested and deployed.
3. **Time constraint.** Hybrid is 2–3 weeks of focused work; full rewrite is 4–6 weeks.
4. **Reversibility.** Any SPA page can be ported to EJS later without disruption.
5. **Alignment with the guide's intent.** The guide's stated goal (Part 1.2) is _"re-use your existing controllers, models and views rather than rewriting."_ Hybrid is the truest form of that principle.

## What This Means for Each Phase

| Phase | Full Path B                                     | Our Hybrid                                     |
| ----- | ----------------------------------------------- | ---------------------------------------------- |
| 0     | Discovery                                       | Same                                           |
| 1     | Design system                                   | **Same** — build once, apply everywhere        |
| 2     | Rebuild all public pages in EJS                 | Build only the **missing** public pages in EJS |
| 3     | Auth + profiles + verification                  | Auth done; **add approval flow**               |
| 4     | Contributions + moderation                      | **Already done** ✅                            |
| 5     | Announcements, Archive, Mentorship, Super Admin | Mentorship done; **build the rest**            |
| 6     | QA + launch                                     | Same                                           |
| 7     | Post-launch                                     | Deferred                                       |

## Out of Scope (Documented Deferrals)

- Real-time direct messaging (Workplan Phase 7)
- Class-year community pages (Workplan Phase 7)
- Alumni map (Workplan Phase 7)
- Badges / recognition system (Workplan Phase 7)
- Payments / dues (Workplan Phase 7)
- Custom analytics (may add privacy-friendly Umami later)

## Staging Strategy

- **Local:** `localhost:3000` (Express) + `localhost:5432` (local Postgres via `hosa_dev` database)
- **Production:** Render Web Service + Supabase Postgres
- No separate cloud staging environment at this time. All testing happens locally; deployment to production happens after each phase gate passes.

## Rollback

`main` branch remains deployable throughout. If the hybrid work breaks something, `git checkout main` restores the previous deployed state. No phase will be merged to `main` without a passing gate.

## Review

Revisit after Phase 6 (launch). If traffic or feature gaps make a specific SPA page a bottleneck, port that one page to EJS as a Phase 7 item.
