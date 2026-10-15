# HOSA Threat Model (living document)

## Assets

Credentials, sessions, private profile fields, pending submissions, audit trail.

## Trust boundaries

- Browser ↔ Express (untrusted input)
- Express ↔ Postgres (parameterized queries only)
- Express ↔ Supabase Storage (server-only service key, later phase)

## Threats & mitigations

| Threat              | Mitigation                                                              |
| ------------------- | ----------------------------------------------------------------------- |
| SQL injection       | `pg` parameterized queries only                                         |
| XSS                 | EJS auto-escape with `<%= %>`; never `<%- %>` on user content           |
| Session hijack      | `HttpOnly`, `Secure`, `SameSite` cookies; regenerate on login (Phase 2) |
| Password cracking   | argon2id with tuned parameters (Phase 2)                                |
| Account enumeration | Generic login errors + rate limits (Phase 2)                            |
| Role escalation     | Roles checked server-side; role IDs never accepted from forms           |
| Upload abuse        | (Later) MIME + signature validation, size limits, random keys           |
| Secrets leakage     | `.env` never committed; logs redact sensitive fields                    |
