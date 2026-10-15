# Phase 4A — Admin shell checklist

## Setup

- [ ] `npm run migrate` shows `007_audit_and_admin.sql` applied
- [ ] `audit_logs` table exists: `\d audit_logs` in psql
- [ ] `npm run dev` starts cleanly

## Roles

- [ ] Give test account the admin role via psql (step 11)
- [ ] Log out and back in
- [ ] Nav shows "Admin" link
- [ ] http://localhost:3000/admin renders overview with real counts

## Access control

- [ ] Log out, register a fresh member account (`test2@example.com`)
- [ ] Nav does NOT show "Admin"
- [ ] http://localhost:3000/admin returns 403 Forbidden
- [ ] Log back in as test1 → /admin works again

## Audit

- [ ] Confirm the audit table is empty: `SELECT COUNT(*) FROM audit_logs;`
- [ ] (Nothing writes to it yet — that starts in Phase 4B)

## Regression

- [ ] http://localhost:3000/ — SPA still loads
- [ ] http://localhost:3000/#/directory — members render
- [ ] /dashboard, /dashboard/profile, /dashboard/password all still work
