import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { http1Fetch } from "@/lib/supabase/http1";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  if (!isSupabaseConfigured()) {
    return response;
  }

  const hasSessionCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.endsWith("-auth-token"));

  if (!hasSessionCookie) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: http1Fetch },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: ReadonlyArray<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Decode the session from the cookie locally and only refresh when the
  // access token is expired. This avoids a network call to the Supabase auth
  // API on every navigation (each one costs a fresh TLS handshake here).
  await supabase.auth.getSession();

  return response;
}

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};