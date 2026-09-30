"use server";

import { revalidatePath } from "next/cache";
import {
  clearTimetableCell,
  createTimetablePeriod,
  deleteTimetablePeriod,
  saveTimetableCell,
} from "@/services/timetable";

// Shared by the school and teacher timetables, the way app/learn/material-actions.ts
// is shared by the teacher uploader and the student viewer. Both dashboards
// render the same grid, so both need the same four mutations and neither should
// have its own copy.

export type ActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

function message(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

async function run(fn: () => Promise<void>, paths: string[]): Promise<ActionState> {
  try {
    await fn();
    for (const path of paths) revalidatePath(path);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

const PATHS = ["/school/timetable", "/teacher/timetable", "/student/timetable"];

export async function saveTimetableCellAction(input: {
  classId: string;
  sessionId: string;
  dayOfWeek: number;
  periodId: string;
  subjectId: string;
  teacherId: string | null;
}): Promise<ActionState> {
  return run(async () => saveTimetableCell(input), PATHS);
}

export async function clearTimetableCellAction(input: {
  classId: string;
  sessionId: string;
  dayOfWeek: number;
  periodId: string;
}): Promise<ActionState> {
  return run(async () => clearTimetableCell(input), PATHS);
}

export async function createTimetablePeriodAction(input: {
  name: string;
  startTime: string;
  endTime: string;
  isBreak?: boolean;
}): Promise<ActionState> {
  return run(async () => createTimetablePeriod(input), PATHS);
}

export async function deleteTimetablePeriodAction(id: string): Promise<ActionState> {
  return run(async () => deleteTimetablePeriod(id), PATHS);
}
