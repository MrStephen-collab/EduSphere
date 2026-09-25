import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client.
 *
 * Use ONLY on the server for trusted operations (migrations, seeding,
 * admin-level cross-tenant tasks). Never expose this client to the browser.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}