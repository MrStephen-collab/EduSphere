"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth/auth-context";
import { markNotificationsRead } from "@/services/notifications";

export type NotificationsActionState =
  | { ok: true }
  | { ok: false; error: string };

export async function markReadAction(ids?: string[]): Promise<NotificationsActionState> {
  const context = await getAuthContext();
  if (!context.user) return { ok: false, error: "Sign in to manage notifications." };
  try {
    await markNotificationsRead(context.user.id, ids);
    revalidatePath("/notifications");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Something went wrong.",
    };
  }
}