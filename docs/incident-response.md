# HOSA Incident Response Plan

This document outlines the steps to take if the HOSA website goes down, is compromised, or experiences a critical failure.

## 1. Key Contacts

- **Lead Developer:** Ronald Kabanda — [INSERT EMAIL] — [INSERT PHONE]
- **HOSA Leadership Contact:** [INSERT NAME OF CHAIRPERSON] — [INSERT EMAIL] — [INSERT PHONE]
- **Hosting Provider (Render):** https://dashboard.render.com
- **Database Provider (Supabase):** https://supabase.com/dashboard

## 2. Severity Levels

- **SEV-1 (Critical):** The site is down, database is lost, or there is a security breach (e.g., data leak).
- **SEV-2 (High):** A core feature is broken (e.g., users cannot log in, jobs cannot be posted).
- **SEV-3 (Medium):** A minor feature is broken (e.g., a specific page shows a 500 error, styling is broken).

## 3. Immediate Response Steps (SEV-1 or SEV-2)

### Step 1: Acknowledge

Notify the HOSA Leadership Contact immediately that you are aware of the issue and are investigating.

### Step 2: Check the Logs

1. Go to **Render Dashboard** -> **hosa_websiterk** -> **Logs**.
2. Look for red `ERROR` lines. Common culprits:
   - `DatabaseError` (database is down or a column is missing).
   - `ERR_MODULE_NOT_FOUND` (a package wasn't installed).
   - `Exited with status 1` (the server crashed on startup).

### Step 3: Check the Database

1. Go to **Supabase Dashboard**.
2. Check **Database** -> **Health**. Ensure the database is online.
3. Check the `schema_migrations` table to see if a recent migration was only partially applied.

### Step 4: Rollback

If the issue started right after a deployment:

1. Go to **Render Dashboard** -> **hosa_websiterk** -> **Events**.
2. Find the last successful deployment.
3. Click **Rollback to this deploy**.
4. If the database was affected, follow the `docs/backups.md` guide to restore from a backup.

### Step 5: Post-Incident

Once the site is back online:

1. Notify the HOSA Leadership Contact.
2. Write a brief summary in `docs/incidents/YYYY-MM-DD.md` detailing:
   - What happened
   - How it was fixed
   - What steps will be taken to prevent it from happening again.
