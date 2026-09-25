"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/auth-context";
import { createAdminClient } from "@/lib/supabase/admin";

export type AccountActionState = { error?: string; success?: boolean };

export async function updateAccountAction(
  _prev: AccountActionState | null,
  formData: FormData,
): Promise<AccountActionState> {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");

  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const avatarUrl = String(formData.get("avatarUrl") ?? "").trim() || null;

  if (!fullName) {
    return { error: "Full name is required." };
  }
  if (avatarUrl && !/^https?:\/\//.test(avatarUrl)) {
    return { error: "Avatar URL must start with http(s)://." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ full_name: fullName, phone, avatar_url: avatarUrl })
    .eq("id", context.user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true };
}