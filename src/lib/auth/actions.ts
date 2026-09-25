"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth/auth-context";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";

export type ActionState = {
  error?: string;
  success?: boolean;
};

function isNetworkError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("fetch failed") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    normalized.includes("undici") ||
    normalized.includes("load failed")
  );
}

// Supabase auth calls occasionally fail once with a transport-level error
// (e.g. a wedged keep-alive socket in the Next runtime while fetching GoTrue).
// The wedge is transient: pooling drops dead sockets after a moment, so we
// wait briefly before retrying on a fresh client.
const AUTHRETRY_DELAY_MS = 2500;

async function authWithRetry<T extends { error: AuthError | null }>(
  run: (
    supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  ) => Promise<T>,
): Promise<T> {
  const first = await createSupabaseServerClient();
  const result = await run(first);
  if (result.error && isNetworkError(result.error.message)) {
    console.error(`[authWithRetry] transient auth failure: ${result.error.message}; retrying after ${AUTHRETRY_DELAY_MS}ms`);
    await new Promise((resolve) => setTimeout(resolve, AUTHRETRY_DELAY_MS));
    const second = await createSupabaseServerClient();
    return run(second);
  }
  return result;
}

export async function loginAction(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await authWithRetry((supabase) =>
    supabase.auth.signInWithPassword(parsed.data),
  );

  if (error) {
    if (isNetworkError(error.message)) {
      return { error: "Could not reach the server. Check your connection and try again." };
    }
    return { error: "Invalid email or password" };
  }

  // Warm the auth-context cache with the freshly-issued session token so the
  // redirected dashboard renders from cache instead of paying the cold
  // profile/role/membership round trips again. Never fail the login if the
  // warm-up hits a transient network error.
  try {
    await getAuthContext();
  } catch (err) {
    console.error("[loginAction] warm-up failed", err);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function registerAction(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    schoolName: formData.get("schoolName"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const result = await authWithRetry((supabase) =>
    supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          full_name: parsed.data.fullName,
        },
      },
    }),
  );
  const { data, error } = result;

  if (error) {
    if (isNetworkError(error.message)) {
      return { error: "Could not reach the server. Check your connection and try again." };
    }
    return { error: error.message };
  }

  if (data.session) {
    redirect("/auth/login");
  }

  return {
    success: true,
    error: "Check your email to confirm your account.",
  };
}

export async function logoutAction(): Promise<void> {
  await authWithRetry((supabase) => supabase.auth.signOut());
  revalidatePath("/", "layout");
  redirect("/auth/login");
}

export async function forgotPasswordAction(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await authWithRetry((supabase) =>
    supabase.auth.resetPasswordForEmail(parsed.data.email),
  );

  if (error) {
    if (isNetworkError(error.message)) {
      return { error: "Could not reach the server. Check your connection and try again." };
    }
    return { error: error.message };
  }

  return { success: true };
}

export async function resetPasswordAction(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await authWithRetry((supabase) =>
    supabase.auth.updateUser({
      password: parsed.data.password,
    }),
  );

  if (error) {
    if (isNetworkError(error.message)) {
      return { error: "Could not reach the server. Check your connection and try again." };
    }
    return { error: error.message };
  }

  return { success: true };
}