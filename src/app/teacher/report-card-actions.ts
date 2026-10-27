"use server";

import { revalidatePath } from "next/cache";
import {
  saveTraditionalReportCard,
  type SaveTraditionalReportInput,
} from "@/services/traditional-report-cards";

export type TraditionalReportActionState =
  | { ok: true; id: string; savedAt: string }
  | { ok: false; error: string };

function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

export async function saveTraditionalReportCardAction(
  input: SaveTraditionalReportInput,
): Promise<TraditionalReportActionState> {
  try {
    const id = await saveTraditionalReportCard(input);
    revalidatePath("/teacher/report-cards/entry");
    revalidatePath("/teacher/report-cards");
    revalidatePath("/school/report-cards");
    revalidatePath("/student/report-cards");
    revalidatePath("/parent/report-cards");
    return { ok: true, id, savedAt: new Date().toISOString() };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}
