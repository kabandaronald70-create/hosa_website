# HOSA Route & Feature Inventory

**Baseline as of:** 2026-10-18
**Last updated:** 2026-10-18

Legend:

- **Frontend** = the source of rendering (SPA = Vite React-less vanilla JS; EJS = server-rendered)
- **Data** = where the data comes from
- **Persist** = what user state survives a page refresh
- **Status** = ✅ works / ⚠️ partial / ❌ broken

---

## Public Routes

| Route                    | Frontend | Data                      | Persist           | Status |
| ------------------------ | -------- | ------------------------- | ----------------- | ------ |
| `/` (SPA Home)           | SPA      | `/api/*` counts + stories | —                 | ✅     |
| `/#/directory`           | SPA      | `/api/directory`          | filters in memory | ✅     |
| `/#/member/:id`          | SPA      | `/api/directory`          | —                 | ✅     |
| `/#/events`              | SPA      | `/api/events`             | —                 | ✅     |
| `/#/jobs`                | SPA      | `/api/opportunities`      | —                 | ✅     |
| `/#/stories`             | SPA      | `/api/stories`            | —                 | ✅     |
| `/#/story/:id`           | SPA      | `/api/stories`            | —                 | ✅     |
| `/#/mentorship`          | SPA      | static                    | —                 | ✅     |
| `/#/privacy`             | SPA      | static                    | —                 | ✅     |
| `/health`                | Express  | DB ping                   | —                 | ✅     |
| `/api/health`            | Express  | —                         | —                 | ✅     |
| `/api/directory`         | Express  | PostgreSQL                | —                 | ✅     |
| `/api/directory/:id`     | Express  | PostgreSQL                | —                 | ✅     |
| `/api/events`            | Express  | PostgreSQL                | —                 | ✅     |
| `/api/events/:slug`      | Express  | PostgreSQL                | —                 | ✅     |
| `/api/stories`           | Express  | PostgreSQL                | —                 | ✅     |
| `/api/opportunities`     | Express  | PostgreSQL                | —                 | ✅     |
| `/api/me`                | Express  | session → user            | —                 | ✅     |
| `/api/me/saved`          | Express  | saved_items               | —                 | ✅     |
| `/api/me/rsvps`          | Express  | event_rsvps               | —                 | ✅     |
| `/api/me/notifications`  | Express  | notifications             | —                 | ✅     |
| `POST /api/saved`        | Express  | session + DB              | —                 | ✅     |
| `DELETE /api/saved/:id`  | Express  | session + DB              | —                 | ✅     |
| `POST /api/rsvp/:slug`   | Express  | session + DB              | —                 | ✅     |
| `DELETE /api/rsvp/:slug` | Express  | session + DB              | —                 | ✅     |

## Auth Routes

| Route            | Frontend       | Data            | Persist           | Status |
| ---------------- | -------------- | --------------- | ----------------- | ------ |
| `GET /register`  | EJS            | —               | —                 | ✅     |
| `POST /register` | EJS → redirect | users + profile | session cookie    | ✅     |
| `GET /login`     | EJS            | —               | —                 | ✅     |
| `POST /login`    | EJS → redirect | users           | session cookie    | ✅     |
| `POST /logout`   | EJS → redirect | —               | session destroyed | ✅     |

## Member Routes (require login)

| Route                                             | Frontend           | Data                       | Persist | Status |
| ------------------------------------------------- | ------------------ | -------------------------- | ------- | ------ |
| `/dashboard`                                      | EJS                | profile, RSVPs, mentorship | session | ✅     |
| `/dashboard/profile`                              | EJS                | member_profiles            | session | ✅     |
| `POST /dashboard/profile`                         | EJS → redirect     | member_profiles            | session | ✅     |
| `POST /dashboard/avatar`                          | EJS → redirect     | Supabase Storage           | session | ✅     |
| `POST /dashboard/avatar/delete`                   | EJS → redirect     | Supabase Storage           | session | ✅     |
| `GET /dashboard/avatar/:id`                       | Express → redirect | signed URL                 | —       | ✅     |
| `/dashboard/password`                             | EJS                | —                          | —       | ✅     |
| `POST /dashboard/password`                        | EJS → redirect     | users.password_hash        | session | ✅     |
| `/dashboard/saved`                                | EJS                | saved_items + joins        | —       | ✅     |
| `/dashboard/submissions`                          | EJS                | stories + opportunities    | —       | ✅     |
| `/dashboard/stories/new`                          | EJS                | —                          | —       | ✅     |
| `POST /dashboard/stories/new`                     | EJS → redirect     | stories                    | —       | ✅     |
| `/dashboard/opportunities/new`                    | EJS                | —                          | —       | ✅     |
| `POST /dashboard/opportunities/new`               | EJS → redirect     | opportunities              | —       | ✅     |
| `/dashboard/mentorship/requests`                  | EJS                | mentorship_requests        | —       | ✅     |
| `/dashboard/mentorship/requests/new`              | EJS                | mentorship_requests        | —       | ✅     |
| `POST /dashboard/mentorship/requests/new`         | EJS → redirect     | mentorship_requests        | —       | ✅     |
| `POST /dashboard/mentorship/requests/:id/accept`  | EJS → redirect     | mentorship_requests        | —       | ✅     |
| `POST /dashboard/mentorship/requests/:id/decline` | EJS → redirect     | mentorship_requests        | —       | ✅     |
| `POST /dashboard/mentorship/requests/:id/cancel`  | EJS → redirect     | mentorship_requests        | —       | ✅     |
| `/notifications`                                  | EJS                | notifications              | —       | ✅     |
| `POST /notifications/:id/read`                    | EJS → redirect     | notifications.read_at      | —       | ✅     |
| `POST /notifications/read-all`                    | EJS → redirect     | notifications.read_at      | —       | ✅     |
| `POST /events/:slug/rsvp`                         | EJS → redirect     | event_rsvps                | —       | ✅     |
| `POST /events/:slug/rsvp/cancel`                  | EJS → redirect     | event_rsvps                | —       | ✅     |

## Admin Routes (require admin/moderator)

| Route                                              | Frontend       | Data                            | Persist | Status |
| -------------------------------------------------- | -------------- | ------------------------------- | ------- | ------ |
| `/admin`                                           | EJS            | admin counts + recent audits    | —       | ✅     |
| `/admin/members`                                   | EJS            | listMembers                     | —       | ✅     |
| `/admin/members/:id`                               | EJS            | getMemberForAdmin               | —       | ✅     |
| `POST /admin/members/:id/verify`                   | EJS → redirect | member_profiles.verified_at     | —       | ✅     |
| `POST /admin/members/:id/unverify`                 | EJS → redirect | member_profiles.verified_at     | —       | ✅     |
| `POST /admin/members/:id/suspend`                  | EJS → redirect | users.status                    | —       | ✅     |
| `POST /admin/members/:id/reactivate`               | EJS → redirect | users.status                    | —       | ✅     |
| `/admin/moderation`                                | EJS            | pending stories + opportunities | —       | ✅     |
| `POST /admin/moderation/stories/:id/approve`       | EJS → redirect | stories.status                  | —       | ✅     |
| `POST /admin/moderation/stories/:id/reject`        | EJS → redirect | stories.status + reason         | —       | ✅     |
| `POST /admin/moderation/opportunities/:id/approve` | EJS → redirect | opportunities.status            | —       | ✅     |
| `POST /admin/moderation/opportunities/:id/reject`  | EJS → redirect | opportunities.status + reason   | —       | ✅     |
| `/admin/events`                                    | EJS            | events                          | —       | ✅     |
| `/admin/events/new`                                | EJS            | —                               | —       | ✅     |
| `POST /admin/events/new`                           | EJS → redirect | events                          | —       | ✅     |
| `/admin/events/:id`                                | EJS            | event + RSVP counts             | —       | ✅     |
| `/admin/events/:id/edit`                           | EJS            | events                          | —       | ✅     |
| `POST /admin/events/:id/update`                    | EJS → redirect | events                          | —       | ✅     |
| `POST /admin/events/:id/status`                    | EJS → redirect | events.status                   | —       | ✅     |
| `/admin/audit`                                     | EJS            | audit_logs                      | —       | ✅     |
| `/admin/audit/:id`                                 | EJS            | audit_logs                      | —       | ✅     |
| `/admin/audit/export.csv`                          | Express        | audit_logs                      | —       | ✅     |

## Database Tables (13 migrations applied)

| Table                    | Purpose              |
| ------------------------ | -------------------- |
| `schema_migrations`      | Migration tracking   |
| `users`                  | Accounts             |
| `roles`                  | Role definitions     |
| `user_roles`             | Role assignments     |
| `member_profiles`        | Profile data         |
| `session`                | Express sessions     |
| `events`                 | Events               |
| `event_rsvps`            | RSVPs                |
| `opportunity_categories` | Job types            |
| `opportunities`          | Jobs / internships   |
| `stories`                | Alumni stories       |
| `mentorship_requests`    | Mentor relationships |
| `saved_items`            | Bookmarks            |
| `audit_logs`             | Admin action trail   |
| `notifications`          | In-app alerts        |

## Missing (per Workplan)

| Feature                                                  | Workplan phase |
| -------------------------------------------------------- | -------------- |
| Email verification                                       | Phase 3        |
| Password reset                                           | Phase 3        |
| Alumni verification workflow (class-year admin approval) | Phase 3        |
| Per-field visibility (Public / Members / Only me)        | Phase 3        |
| Data export + account deletion                           | Phase 3        |
| About page                                               | Phase 2        |
| Legal pages (Privacy / Terms / Help / Contact)           | Phase 2        |
| Announcements                                            | Phase 5        |
| Archive                                                  | Phase 5        |
| Super Admin (roles, settings, health)                    | Phase 5        |
| Global design system (colors, fonts, components)         | Phase 1        |
| App sidebar (distinct from top nav)                      | Phase 1        |
| Styleguide page                                          | Phase 1        |
| Reports (user flags content)                             | Phase 5        |
| 404 + 500 error pages                                    | Phase 2        |

## Baseline Screenshots

Screenshots captured (to be saved in `docs/baseline-screenshots/`):

- `home-375.png`
- `home-768.png`
- `home-1280.png`
- `directory-375.png`
- `directory-768.png`
- `directory-1280.png`
- `events-*.png`
- `jobs-*.png`
- `stories-*.png`
- `dashboard-*.png`
- `admin-*.png`
