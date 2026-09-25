import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { http1Fetch } from "./http1";

// All Supabase traffic is routed over fresh HTTP/1.1 connections. The pooled
// HTTP/2 sessions used by undici's default fetch die after a few requests on
// this network (ERR_HTTP2_INVALID_SESSION) and then fail for every call until
// the process restarts; this transport avoids that entirely.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: http1Fetch },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
}