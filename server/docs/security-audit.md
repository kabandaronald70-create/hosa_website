# Security Audit — HOSA Production Deployment

_Last reviewed: October 2026_

This document is a living audit of the security posture of the HOSA alumni
platform. It is written for maintainers, graders, and future contributors.

---

## 1. Threat Model

### Assets to protect

- User credentials (password hashes)
- Session identifiers
- Private profile fields (email, phone)
- Pending content (unmoderated stories and opportunities)
- Admin action history
- Supabase Storage objects (avatars)
- Supabase service-role key

### Trust boundaries

- **Browser ↔ Express** — all browser input is untrusted
- **Express ↔ PostgreSQL** — parameterized queries only; never string interpolation
- **Express ↔ Supabase Storage** — service-role key held only on the server
- **CI ↔ Production** — production secrets never appear in CI

### Assumptions

- HTTPS is provided by Render in production
- `SESSION_SECRET` and `CSRF_SECRET` are unique to each environment
- The service-role key has never been exposed to a browser or a public repo
- Supabase Postgres is reachable only over SSL from Render

---

## 2. Mitigations by Threat Category

| Threat                    | Mitigation                                                                                  | Where implemented                                   | Status |
| ------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------ |
| Password cracking         | Argon2id (64 MB, t=3, p=4)                                                                  | `services/passwordService.js`                       | ✅     |
| Credential stuffing       | Rate limit 10 login attempts / 15 min / IP                                                  | `middleware/rateLimit.js`                           | ✅     |
| Account enumeration       | Generic "Invalid email or password" on failure                                              | `controllers/authController.js`                     | ✅     |
| Session fixation          | `req.session.regenerate()` on login                                                         | `controllers/authController.js`                     | ✅     |
| Session theft             | `HttpOnly`, `Secure`, `SameSite=Lax` cookies                                                | `config/session.js`                                 | ✅     |
| CSRF                      | Signed HMAC tokens in every form; JSON API bypass only for `Content-Type: application/json` | `middleware/csrf.js`                                | ✅     |
| SQL injection             | Parameterized queries via `pg` — no string concatenation                                    | All `models/*.js`                                   | ✅     |
| XSS (stored)              | EJS auto-escaping (`<%= %>`); user content never rendered via `<%- %>`                      | All `.ejs` views                                    | ✅     |
| Upload abuse              | MIME + magic-byte validation via `file-type`, 2 MB cap, random keys                         | `middleware/upload.js`, `services/avatarService.js` | ✅     |
| Role escalation           | Roles granted only via server-side services; never accepted from forms                      | `models/userModel.js`, `services/profileService.js` | ✅     |
| Admin action forgery      | Every action logged with actor, IP, user-agent, safe metadata                               | `services/auditService.js`                          | ✅     |
| DoS / scraping            | API rate limit 100 req/min/IP; submissions 10/hour/IP                                       | `routes/apiPublic.js`, `routes/submissionRoutes.js` | ✅     |
| Secret leakage in logs    | Pino redaction of `password`, `token`, `secret`, `cookie`, `authorization`                  | `utils/logger.js`                                   | ✅     |
| Unsafe file storage names | `crypto.randomUUID()` object keys; original filename never used                             | `services/avatarService.js`                         | ✅     |
| HTTPS downgrade           | Helmet `upgrade-insecure-requests` in CSP                                                   | `app.js`                                            | ✅     |
| Clickjacking              | `X-Frame-Options: SAMEORIGIN` (Helmet default)                                              | `app.js`                                            | ✅     |
| MIME sniffing             | `X-Content-Type-Options: nosniff` (Helmet default)                                          | `app.js`                                            | ✅     |
| Referer leakage           | `Referrer-Policy: no-referrer` (Helmet default)                                             | `app.js`                                            | ✅     |

---

## 3. Known Limitations (Documented, Not Hidden)

These are deliberate scope decisions, not oversights.

### Email verification — not implemented

No transactional email provider is configured. Users become active on
registration. **Risk:** an attacker can register with an email they don't own.
**Mitigation:** all sensitive actions require a current password; email is not
used for authentication.
**Roadmap:** integrate Resend (or SendGrid) + `email_verification_tokens` table.

### Password reset — not implemented

Same reason. Users must contact an admin to reset a forgotten password.
**Roadmap:** same email integration.

### Notifications — in-app only (planned)

Blueprint Section 4.7 calls for in-app notifications. Not yet implemented.
**Impact:** members don't get a live signal when their content is approved or
rejected; they must check `/dashboard/submissions`. Moderators must check
`/admin/moderation`.

### Data export and account deletion — not implemented

Members cannot currently export their data or delete their account via the UI.
**Roadmap:** `GET /dashboard/export.json` and `POST /dashboard/delete-account`
(both require current password).

### Free tier caveats

- **Render free Web Service** spins down after 15 min of inactivity; cold start
  is ~30 s. Not a security concern, but a UX one.
- **Supabase free** projects pause after 7 days of inactivity; data is retained
  but the project must be unpaused manually.
- **Supabase free** provides daily automated backups with 7-day retention.
  Restore is available via Dashboard → Database → Backups.

---

## 4. Secrets Handling

### What lives where

| Secret                      | Location                               | Never appears in                  |
| --------------------------- | -------------------------------------- | --------------------------------- |
| `PGPASSWORD`                | `server/.env` (dev), Render env (prod) | Git, logs, error pages, CI output |
| `SESSION_SECRET`            | same                                   | same                              |
| `CSRF_SECRET`               | same                                   | same                              |
| `SUPABASE_SERVICE_ROLE_KEY` | same                                   | browser JS, git, logs             |

### Rotation history

On **2026-10-15**, a commit accidentally contained real values for
`SESSION_SECRET`, `CSRF_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY` in
`server/.env.example`. The commit was pushed to a public repo before being
noticed.

**Response:**

1. All three secrets were rotated immediately in Supabase and in Render.
2. `server/.env.example` was rewritten with placeholders only.
3. A defensive grep was added to the pre-commit habit:
   `Select-String -Path server\.env.example -Pattern "sb_secret_|eyJ[A-Za-z0-9_-]{20,}"`
4. The leaked commit remains in Git history — but its values are now dead.

### What is checked in

- `server/.env.example` — placeholders only
- `server/db/migrations/*.sql` — schema, no secrets
- `server/db/import-json.js` — seeder, no secrets
- `README.md`, `docs/*` — no secrets

### What is gitignored

- `server/.env`, `server/.env.local`
- `server/node_modules/`, `server/public/dist/`
- Root `node_modules/`, `dist/`, `.env`

---

## 5. Transport and Storage

### Transport

- **Browser → Render** — HTTPS enforced. Helmet sends
  `Strict-Transport-Security` and `upgrade-insecure-requests`.
- **Render → Supabase Postgres** — TLS. `db.js` sets `ssl: { rejectUnauthorized: false }`
  when `NODE_ENV=production` (required by the Supabase pooler; the pooler's CA
  is not in Node's default trust store).
- **Render → Supabase Storage** — HTTPS via the official Supabase SDK.

### Storage

- Avatars: **private bucket** in Supabase Storage. Access is only via short-lived
  (60 s) signed URLs issued by Express on request. The bucket is never public.
- Uploaded files are served through `/dashboard/avatar/:id` which validates
  session + ownership + `public_visibility` before redirecting to the signed URL.

---

## 6. Operational Monitoring

### What is logged

- Structured JSON logs via Pino.
- Every HTTP request (method, URL, status, response time, IP).
- Every admin/moderator action → `audit_logs` table.
- Every authentication event (success, failure, session regeneration).
- Every unhandled error → `logger.error({ err })` with stack (dev) or message (prod).

### What is never logged

- Passwords, password hashes, session IDs, CSRF tokens
- Service-role keys, database passwords, JWT tokens
- Cookie values, `Authorization` headers
- Full email bodies (when the email subsystem is added)

Enforced via Pino's `redact` config in `server/src/utils/logger.js`.

### Audit log retention

Retained indefinitely in `audit_logs`. Accessible via `/admin/audit` with
filter-by-actor, filter-by-action, date range, and CSV export.

---

## 7. Compliance / Data Minimization

- We collect only email, name, graduation year, and optional location/profession.
- Directory fields are private by default unless the member opts in.
- Email and phone are hidden from public views unless the member explicitly
  enables them.
- No third-party analytics or tracking scripts are loaded.
- No advertising SDKs.

---

## 8. Review checklist (for maintainers)

Run this before each significant deploy:

- [ ] `npm audit` — no high-severity runtime vulnerabilities in root or `server/`
- [ ] `git status` — `server/.env` is not staged
- [ ] `git show HEAD:server/.env.example` — no real secrets in placeholders
- [ ] Verify `NODE_ENV=production` is set in Render (SSL to Supabase required)
- [ ] Verify `SUPABASE_SERVICE_ROLE_KEY` in Render matches the current Supabase key
- [ ] Confirm `/health` returns `{status: "ok", db: "ok"}`
- [ ] Confirm `/login` rate limit blocks >10 attempts / 15 min (test in staging)

---

## 9. References

- [OWASP Top 10 (2021)](https://owasp.org/www-project-top-ten/)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [CSE 340 course overview](https://byui-cse.github.io/cse340-course/index.html)
- [Supabase security model](https://supabase.com/docs/guides/auth#security)
- [Render security model](https://render.com/docs/security)
