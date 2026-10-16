# Phase 4E — Audit log viewer checklist

## Setup

- [ ] `npm run dev` starts cleanly
- [ ] You have some audit entries already (from Phases 4B/4C/4D)

## List

- [ ] /admin/audit shows all recent entries, newest first
- [ ] Entry count matches the "admin actions (7d)" stat on /admin
- [ ] "admin actions (7d)" link on /admin lands on the audit page

## Filters

- [ ] Filter action=member.verify → only member verifications
- [ ] Filter targetType=event → only event actions
- [ ] Filter actor=test1 → only your actions (assuming your email contains test1)
- [ ] Filter from=<today> to=<today> → only today's actions
- [ ] Filters persist across pagination links

## Detail

- [ ] Click "View" on an entry → full detail page
- [ ] Metadata JSON renders as a table of key/value
- [ ] No secret-looking keys (password, token, secret) display raw values

## Export

- [ ] Click "Export CSV" with no filters → downloads a .csv with all entries
- [ ] Open in Excel/Sheets → columns correct, no formula injection (no `=` prefix unescaped)
- [ ] Export with an action filter → CSV contains only those rows
- [ ] Export with a targetType filter → only those rows

## Regression

- [ ] /admin still shows correct counts
- [ ] Members, Moderation, Events sections still work
- [ ] SPA still loads at /
