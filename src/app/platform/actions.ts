"use server";

import { revalidatePath } from "next/cache";
import {
  platformCreatePlan,
  platformUpdatePlan,
  platformSetPlanStatus,
  platformRefundPayment,
  platformSetSchoolPlan,
  type PlanInput,
} from "@/services/billing";
import {
  platformArchiveSchool,
  platformDeleteSchool,
  platformRestoreSchool,
  platformSetSchoolLevel,
  platformSetSchoolStatus,
  platformUpdateSchool,
  setSupportTicketStatus,
  type PlatformSchoolStatus,
} from "@/services/platform";
import type { EducationLevel } from "@/types/database";

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

export async function updateSchoolAction(
  id: string,
  input: unknown,
): Promise<PlatformActionState> {
  try {
    await platformUpdateSchool(id, input);
    revalidatePath("/platform/schools");
    return { ok: true, message: "School updated." };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function setSchoolStatusAction(
  id: string,
  status: PlatformSchoolStatus,
): Promise<PlatformActionState> {
  try {
    await platformSetSchoolStatus(id, status);
    revalidatePath("/platform/schools");
    return {
      ok: true,
      message: status === "active" ? "School activated." : `School ${status}.`,
    };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function setSchoolLevelAction(
  id: string,
  level: EducationLevel | null,
): Promise<PlatformActionState> {
  try {
    await platformSetSchoolLevel(id, level);
    revalidatePath("/platform/schools");
    return {
      ok: true,
      message: level ? "Portal level updated." : "Portal level cleared.",
    };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function setSchoolPlanAction(
  schoolId: string,
  planId: string,
): Promise<PlatformActionState> {
  try {
    await platformSetSchoolPlan({ schoolId, planId });
    revalidatePath("/platform/schools");
    return { ok: true, message: "Plan updated." };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function archiveSchoolAction(
  id: string,
  confirmation: string,
): Promise<PlatformActionState> {
  try {
    await platformArchiveSchool(id, confirmation);
    revalidatePath("/platform/schools");
    return { ok: true, message: "School archived." };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function restoreSchoolAction(id: string): Promise<PlatformActionState> {
  try {
    await platformRestoreSchool(id);
    revalidatePath("/platform/schools");
    return { ok: true, message: "School restored." };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function deleteSchoolAction(
  id: string,
  confirmation: string,
): Promise<PlatformActionState> {
  try {
    await platformDeleteSchool(id, confirmation);
    revalidatePath("/platform/schools");
    return { ok: true, message: "School deleted permanently." };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}