"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth/auth-context";
import {
  createComplaint,
  replyToComplaint,
  withdrawComplaint,
  type complaintSchema,
} from "@/services/complaints";
import type { z } from "zod";

export type ComplaintActionState =
  | { ok: true; message?: string; complaintId?: string }
  | { ok: false; error: string };

function message(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

export async function raiseComplaintAction(
  input: z.infer<typeof complaintSchema>,
): Promise<ComplaintActionState> {
  try {
    const { complaintId } = await createComplaint(input);
    revalidatePath("/parent/complaints");
    return { ok: true, complaintId, message: "Your complaint has been sent to the school." };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function replyToComplaintAction(input: {
  complaintId: string;
  body: string;
}): Promise<ComplaintActionState> {
  try {
    // The session decides who is replying, so confirm the caller is a real
    // signed-in member before a reply is written on their behalf.
    const context = await getAuthContext();
    if (!context.user) return { ok: false, error: "Please sign in to reply." };

    await replyToComplaint(input);
    revalidatePath("/parent/complaints");
    return { ok: true, message: "Reply sent." };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function withdrawComplaintAction(
  complaintId: string,
): Promise<ComplaintActionState> {
  try {
    const context = await getAuthContext();
    if (!context.user) return { ok: false, error: "Please sign in." };

    await withdrawComplaint(complaintId);
    revalidatePath("/parent/complaints");
    return { ok: true, message: "Complaint withdrawn." };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
