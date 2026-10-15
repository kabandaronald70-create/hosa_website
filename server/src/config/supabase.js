import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

// Server-only client. Uses the service-role key which bypasses RLS.
// NEVER import this file from anything reachable by the browser.
export const supabase = createClient(
  env.supabase.url,
  env.supabase.serviceRoleKey,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
