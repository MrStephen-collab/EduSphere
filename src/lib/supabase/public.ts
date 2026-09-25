import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Public (anon) server client — safe for read-only public data.
 *
 * Unlike the SSR client it does not touch cookies, so pages that only read
 * public data through this client can be statically rendered and cached.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}