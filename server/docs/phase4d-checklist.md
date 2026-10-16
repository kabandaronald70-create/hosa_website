# Phase 4D — Event management checklist

## Setup

- [ ] `npm run migrate` shows `009_event_management.sql` applied
- [ ] `npm run dev` starts

## List

- [ ] /admin/events lists all 6 imported events
- [ ] Filter status=published → 6 events
- [ ] Filter when=upcoming → only events with future dates
- [ ] Filter when=past → only past events
- [ ] Search by title works

## Create

- [ ] /admin/events/new → fill form with future date → submit
- [ ] Land on event detail page with status = draft
- [ ] /admin → upcoming events count grows by 1
- [ ] /api/events does NOT yet include the new draft

## Publish

- [ ] On event detail, click "Publish"
- [ ] Status changes to published
- [ ] /api/events includes the new event

## Edit

- [ ] Click "Edit", change title, save
- [ ] Detail page shows new title
- [ ] Audit log records event.update

## Cancel / Archive

- [ ] Cancel → status becomes cancelled, confirm dialog appeared
- [ ] Cancel → /api/events no longer includes it
- [ ] Archive → status becomes archived

## Validation

- [ ] Submit form with end date BEFORE start date → error
- [ ] Submit with registration deadline AFTER start → error
- [ ] Submit without title → error

## Audit

- [ ] /admin → Recent admin actions shows event.create, event.update, event.publish, event.cancel

## Regression

- [ ] Existing events still visible in /api/events
- [ ] SPA still renders #/events with the same events
