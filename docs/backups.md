# HOSA Backups & Recovery Guide

This document explains how to back up and restore the HOSA database hosted on Supabase.

## 1. Automatic Backups (Supabase)

Supabase automatically takes daily backups of your database (retained for 7 days on the Free tier, longer on Pro).
To view or restore them:

1. Go to your **Supabase Dashboard**.
2. Select your HOSA project.
3. Navigate to **Settings** -> **Database** -> **Backups**.
4. You can download a `.backup` file or click "Restore" next to a specific date.

## 2. Manual Backups (pg_dump)

Before running any major migration or risky change, you should take a manual backup using the command line.

1. Set your Supabase connection variables:
   ```bash
   export PGHOST="aws-1-eu-central-1.pooler.supabase.com"
   export PGPORT="5432"
   export PGUSER="postgres.[YOUR-PROJECT-REF]"
   export PGPASSWORD="[YOUR-DB-PASSWORD]"
   export PGDATABASE="postgres"
   ```

Other Options

## Alternative: The Supabase Dashboard Way (No terminal needed)

If you don't want to use pg_dump or the terminal at all, you can download a backup directly from Supabase:

Go to Supabase Dashboard → your project.

Click Database on the left sidebar.

Click Backups.

Click Download next to any of the daily backups.
