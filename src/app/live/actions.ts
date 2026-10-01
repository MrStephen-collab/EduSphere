"use server";

import { revalidatePath } from "next/cache";
import type { LiveSessionStatus } from "@/types/database";
import {
  createLiveSession,
  deleteLiveSession,
  saveLiveAttendance,
  setLiveSessionStatus,
  setLiveSessionVisibility,
} from "@/services/live";

// Shared by all three dashboards, as app/timetable/actions.ts is. Teachers
// schedule, students only read, and a school admin watches the lot -- but the
// mutations are the same four regardless of who is looking.

export type ActionState =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string };

function message(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

async function run(fn: () => Promise<string | void>, paths: string[]): Promise<ActionState> {
  try {
    const id = await fn();
    for (const path of paths) revalidatePath(path);
    return { ok: true, id: id ?? undefined };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

const PATHS = ["/teacher/live", "/school/live", "/student/live"];

export async function createLiveSessionAction(input: {
  classId: string;
  courseId?: string | null;
  lessonId?: string | null;
  title: string;
  description?: string | null;
  joinUrl: string;
  startsAt: string;
  endsAt?: string | null;
  isVisibleToStudents: boolean;
}): Promise<ActionState> {
  return run(async () => createLiveSession(input), PATHS);
}

export async function setLiveSessionVisibilityAction(
  sessionId: string,
  isVisible: boolean,
): Promise<ActionState> {
  return run(async () => setLiveSessionVisibility(sessionId, isVisible), PATHS);
}

export async function setLiveSessionStatusAction(
  sessionId: string,
  status: LiveSessionStatus,
): Promise<ActionState> {
  return run(async () => setLiveSessionStatus(sessionId, status), PATHS);
}

export async function deleteLiveSessionAction(sessionId: string): Promise<ActionState> {
  return run(async () => deleteLiveSession(sessionId), PATHS);
}

export async function saveLiveAttendanceAction(input: {
  liveSessionId: string;
  entries: { studentId: string; status: "present" | "late" | "absent" | "excused" | null }[];
}): Promise<ActionState> {
  return run(async () => saveLiveAttendance(input), PATHS);
}
