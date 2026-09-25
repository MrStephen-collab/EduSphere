import { redirect } from "next/navigation";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Profile, School, UserRole, UserRoleName } from "@/types/database";

export type Membership = {
  school: School;
  role: UserRoleName;
};

export type AuthContext = {
  user: User | null;
  profile: Profile | null;
  roles: UserRoleName[];
  memberships: Membership[];
};

// The profile/role/membership chain is slow over the remote Supabase connection
// (each read opens a fresh TLS connection, ~500ms here). Auth data rarely
// changes, so the resolved context is cached per access token. The token
// rotates on refresh (~1h) and the TTL bounds staleness after role changes.
const AUTH_CONTEXT_TTL_MS = 45_000;
const contextCache = new Map<string, { value: AuthContext; expiresAt: number }>();

export const getAuthContext = cache(async function getAuthContext(): Promise<AuthContext> {
  if (!isSupabaseConfigured()) {
    return { user: null, profile: null, roles: [], memberships: [] };
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const cacheKey = session?.access_token ?? null;

  if (cacheKey) {
    const hit = contextCache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value;
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null, roles: [], memberships: [] };
  }

  const context = await buildAuthContext(supabase, user);

  if (cacheKey) {
    contextCache.set(cacheKey, {
      value: context,
      expiresAt: Date.now() + AUTH_CONTEXT_TTL_MS,
    });
  }

  return context;
});

async function buildAuthContext(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  user: User,
): Promise<AuthContext> {
  const [profileQuery, roleQuery] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle<Profile>(),
    supabase
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id)
      .returns<Pick<UserRole, "role" | "school_id">[]>(),
  ]);

  const profile = profileQuery.data;
  const roleRows = roleQuery.data ?? [];
  const roles = [...new Set(roleRows.map((r) => r.role))];

  const schoolIds = roleRows.map((r) => r.school_id).filter(Boolean) as string[];

  const memberships: Membership[] = [];

  if (schoolIds.length > 0) {
    const { data: schools } = await supabase
      .from("schools")
      .select("*")
      .in("id", schoolIds)
      .eq("status", "active")
      .returns<School[]>();

    const schoolById = new Map((schools ?? []).map((s) => [s.id, s]));

    for (const row of roleRows) {
      const school = row.school_id ? schoolById.get(row.school_id) : null;
      if (school) {
        memberships.push({ school, role: row.role });
      }
    }
  }

  return { user, profile, roles, memberships };
}

export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login");
  }
  return user;
}

export async function requireAuthContext() {
  const context = await getAuthContext();
  if (!context.user) {
    redirect("/auth/login");
  }
  return context;
}

export function hasSuperAdminRole(context: AuthContext): boolean {
  return context.roles.includes("SUPER_ADMIN");
}

export function redirectToRoleHome(context: AuthContext): never {
  const roles = context.roles;

  if (roles.includes("SUPER_ADMIN")) redirect("/platform");
  if (
    roles.includes("SCHOOL_OWNER") ||
    roles.includes("SCHOOL_ADMIN") ||
    roles.includes("PRINCIPAL")
  ) {
    redirect("/school");
  }
  if (roles.includes("TEACHER")) redirect("/teacher");
  if (roles.includes("STUDENT")) redirect("/student");
  if (roles.includes("PARENT")) redirect("/parent");

  redirect("/school/onboarding");
}