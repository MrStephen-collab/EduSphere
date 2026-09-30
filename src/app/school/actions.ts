"use server";

import { revalidatePath } from "next/cache";
import {
  createClass,
  deleteClass,
  createSubject,
  deleteSubject,
  createStream,
  createSession,
  setCurrentSession,
  setCurrentTerm,
} from "@/services/academics";
import {
  createTeacher,
  createStudent,
  createParent,
  importStudents,
  type ImportRow,
  type ImportSummary,
} from "@/services/people";
import { updateBranding } from "@/services/schools";
import { startCheckout } from "@/services/billing";
import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type AnnouncementInput,
} from "@/services/announcements";
import {
  createEvent,
  updateEvent,
  setEventPublished,
  deleteEvent,
  addGalleryItem,
  deleteGalleryItem,
} from "@/services/school-media";
import {
  replyToComplaint,
  setComplaintStatus,
  type complaintStatusSchema,
} from "@/services/complaints";
import type { z } from "zod";

export type ActionState =
  | { ok: true; message?: string; authorizationUrl?: string }
  | { ok: false; error: string };

function message(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

async function run(fn: () => Promise<void>, path?: string): Promise<ActionState> {
  try {
    await fn();
    if (path) revalidatePath(path);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function createClassAction(input: {
  name: string;
  order?: number;
}): Promise<ActionState> {
  return run(async () => createClass(input), "/school/classes");
}

export async function createStreamAction(input: { name: string }): Promise<ActionState> {
  return run(async () => createStream(input), "/school/classes");
}

export async function deleteClassAction(id: string): Promise<ActionState> {
  return run(async () => deleteClass(id), "/school/classes");
}

export async function createSubjectAction(input: {
  name: string;
  code?: string | null;
}): Promise<ActionState> {
  return run(async () => createSubject(input), "/school/subjects");
}

export async function deleteSubjectAction(id: string): Promise<ActionState> {
  return run(async () => deleteSubject(id), "/school/subjects");
}

export async function createSessionAction(input: {
  name: string;
  startDate?: string | null;
  endDate?: string | null;
}): Promise<ActionState> {
  return run(async () => createSession(input), "/school/sessions");
}

export async function setCurrentSessionAction(id: string): Promise<ActionState> {
  return run(async () => setCurrentSession(id), "/school/sessions");
}

export async function setCurrentTermAction(id: string): Promise<ActionState> {
  return run(async () => setCurrentTerm(id), "/school/sessions");
}

export async function createTeacherAction(input: {
  fullName: string;
  email?: string | null;
  title?: string | null;
}): Promise<ActionState> {
  return run(async () => createTeacher(input), "/school/teachers");
}

export async function createStudentAction(input: {
  fullName: string;
  email?: string | null;
  admissionNumber: string;
  classId?: string | null;
  streamId?: string | null;
  gender?: "male" | "female" | null;
  dateOfBirth?: string | null;
  guardianPhone?: string | null;
}): Promise<ActionState> {
  return run(async () => createStudent(input), "/school/students");
}

export async function importStudentsAction(rows: ImportRow[]): Promise<
  | { ok: true; message: string }
  | { ok: false; error: string }
  | (ImportSummary & { ok: true })
> {
  try {
    const summary = await importStudents(rows);
    revalidatePath("/school/students");
    return { ok: true, ...summary };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export async function startCheckoutAction(
  planId: string,
): Promise<ActionState> {
  try {
    const { authorizationUrl } = await startCheckout(planId);
    return { ok: true, authorizationUrl };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function createParentAction(input: {
  fullName: string;
  email?: string | null;
  relationship?: string | null;
  linkedStudentIds: string[];
}): Promise<ActionState> {
  return run(async () => createParent(input), "/school/parents");
}

export async function updateBrandingAction(input: {
  name?: string;
  motto?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  website?: string;
}): Promise<ActionState> {
  return run(async () => updateBranding(input), "/school/settings");
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

export async function createAnnouncementAction(
  input: AnnouncementInput,
): Promise<ActionState> {
  return run(
    async () => createAnnouncement(input),
    "/school/announcements",
  );
}

export async function updateAnnouncementAction(
  id: string,
  input: AnnouncementInput,
): Promise<ActionState> {
  return run(
    async () => updateAnnouncement(id, input),
    "/school/announcements",
  );
}

export async function deleteAnnouncementAction(
  id: string,
): Promise<ActionState> {
  return run(
    async () => deleteAnnouncement(id),
    "/school/announcements",
  );
}

// ---------------------------------------------------------------------------
// School events & media
// ---------------------------------------------------------------------------

type EventInput = {
  title: string;
  description?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  venue?: string | null;
  coverUrl?: string | null;
  published?: boolean;
};

export async function createEventAction(input: EventInput): Promise<ActionState> {
  return run(
    async () => createEvent(input),
    "/school/events",
  );
}

export async function updateEventAction(
  id: string,
  input: EventInput,
): Promise<ActionState> {
  return run(
    async () => updateEvent(id, input),
    "/school/events",
  );
}

export async function setEventPublishedAction(
  id: string,
  published: boolean,
): Promise<ActionState> {
  return run(
    async () => setEventPublished(id, published),
    "/school/events",
  );
}

export async function deleteEventAction(id: string): Promise<ActionState> {
  return run(
    async () => deleteEvent(id),
    "/school/events",
  );
}

export async function addGalleryItemAction(input: {
  title?: string | null;
  imageUrl: string;
  category?: string | null;
}): Promise<ActionState> {
  return run(
    async () => addGalleryItem(input),
    "/school/media",
  );
}

export async function deleteGalleryItemAction(id: string): Promise<ActionState> {
  return run(
    async () => deleteGalleryItem(id),
    "/school/media",
  );
}

export async function replyToComplaintAction(input: {
  complaintId: string;
  body: string;
}): Promise<ActionState> {
  return run(
    async () => replyToComplaint(input),
    "/school/complaints",
  );
}

export async function setComplaintStatusAction(
  input: z.infer<typeof complaintStatusSchema>,
): Promise<ActionState> {
  return run(
    async () => setComplaintStatus(input),
    "/school/complaints",
  );
}