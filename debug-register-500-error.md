# Debug Session: register-500-error
Status: [OPEN]
Created: 2026-10-20

## 1. Symptoms
- User receives a 500 error page when attempting to register a new member on the live site.
- Registration fails to complete.

## 2. Hypotheses
- H1: Missing `membership_approved_at` column in INSERT in `userModel.js` causing DB error.
- H2: Logic error in `authController.js` (e.g., property access on null, missing import).
- H3: Database constraint violation (e.g., `status` check constraint).
- H4: Stale reference to removed email services in `authController.js`.

## 3. Evidence
- (Pending logs)

## 4. Timeline
- 2026-10-20: Session initialized.
