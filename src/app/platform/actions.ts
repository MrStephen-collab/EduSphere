"use server";

import { revalidatePath } from "next/cache";
import {
  platformCreatePlan,
  platformUpdatePlan,
  platformSetPlanStatus,
  platformRefundPayment,
  type PlanInput,
} from "@/services/billing";
import { setSupportTicketStatus } from "@/services/platform";

export type PlatformActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

function message(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

export async function createPlanAction(input: PlanInput): Promise<PlatformActionState> {
  try {
    await platformCreatePlan(input);
    revalidatePath("/platform/subscriptions");
    return { ok: true, message: "Plan created." };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function updatePlanAction(
  id: string,
  input: Partial<PlanInput>,
): Promise<PlatformActionState> {
  try {
    await platformUpdatePlan(id, input);
    revalidatePath("/platform/subscriptions");
    return { ok: true, message: "Plan updated." };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function setPlanStatusAction(
  id: string,
  status: "active" | "inactive",
): Promise<PlatformActionState> {
  try {
    await platformSetPlanStatus(id, status);
    revalidatePath("/platform/subscriptions");
    return { ok: true, message: status === "active" ? "Plan reactivated." : "Plan deactivated." };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function refundPaymentAction(id: string): Promise<PlatformActionState> {
  try {
    await platformRefundPayment(id);
    revalidatePath("/platform/subscriptions");
    return { ok: true, message: "Payment refunded." };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function setTicketStatusAction(
  id: string,
  status: "open" | "in_progress" | "resolved" | "closed",
): Promise<PlatformActionState> {
  try {
    await setSupportTicketStatus(id, status);
    revalidatePath("/platform/support");
    return { ok: true, message: "Ticket updated." };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}