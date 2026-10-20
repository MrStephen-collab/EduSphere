import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSchoolAdmin } from "@/services/shared";
import {
  ADMISSION_STATUSES,
  admissionStatusLabel,
  admissionSettingsSchema,
} from "@/lib/admission-labels";
import { buildApplicationNumber, isValidEntranceScore } from "@/lib/admission";
import type {
  AdmissionApplication,
  AdmissionEvent,
  AdmissionSettings,
  AdmissionStatus,
} from "@/types/database";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

function emptyToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * The public application form's input.
 *
 * This is the only schema in the product that a signed-out visitor drives, so
 * every field is bounded and every free-text field is capped: there is no
 * account to rate-limit or ban behind it.
 */
export const admissionApplicationSchema = z.object({
  slug: z.string().trim().min(1),
  applicantFirstName: z
    .string()
    .trim()
    .min(1, "Enter the child's first name")
    .max(80),
  applicantLastName: z.string().trim().min(1, "Enter the child's surname").max(80),
  dateOfBirth: z.string().trim().max(10).optional().nullable(),
  gender: z.preprocess(
    emptyToUndefined,
    z.enum(["male", "female"]).optional(),
  ),
  // A class is optional: a school that has not published its classes yet can
  // still take an application, and the admin assigns the class on review.
  classId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  guardianName: z
    .string()
    .trim()
    .min(2, "Enter the parent or guardian's name")
    .max(120),
  guardianEmail: z
    .string()
    .trim()
    .min(1, "Enter an email address")
    .email("Enter a valid email address")
    .max(160),
  guardianPhone: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  previousSchool: z.string().trim().max(160).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const admissionStatusSchema = z.object({
  applicationId: z.string().uuid(),
  status: z.enum(ADMISSION_STATUSES),
  note: z.string().trim().max(1000).optional().nullable(),
});

export const admissionScoreSchema = z.object({
  applicationId: z.string().uuid(),
  score: z.number().min(0, "Score cannot be below 0").max(100, "Score cannot exceed 100"),
  date: z.string().trim().max(10).optional().nullable(),
});

export const admissionNoteSchema = z.object({
  applicationId: z.string().uuid(),
  body: z.string().trim().min(1, "Write a note").max(2000),
});

export type AdmissionApplicationInput = z.infer<typeof admissionApplicationSchema>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Public submission
// ---------------------------------------------------------------------------

/**
 * Files a public application against a school's website.
 *
 * There is no session here: the caller is a visitor, so nothing is trusted from
 * the request beyond the school slug. The school is resolved server-side and
 * the application is written through the service role -- the `anon` database
 * role has no insert policy, so a leaked anon key cannot forge applications.
 */
export async function submitAdmissionApplication(
  input: unknown,
): Promise<{ applicationNumber: string }> {
  const data = admissionApplicationSchema.parse(input);

  if (data.dateOfBirth && !DATE_PATTERN.test(data.dateOfBirth)) {
    throw new Error("Enter the date of birth as a calendar date.");
  }

  const admin = createAdminClient();

  const { data: school } = await admin
    .from("schools")
    .select("id")
    .eq("slug", data.slug)
    .eq("status", "active")
    .maybeSingle();

  if (!school) {
    throw new Error("This school is not accepting applications right now.");
  }

  // Honour the school's admission link settings. A visitor can POST to this
  // endpoint regardless of what the public page rendered, so the window and
  // on/off state are enforced here -- not just hidden in the UI.
  const linkState = await getAdmissionLinkStateBySlug(data.slug);
  const refusal = admissionLinkRefusal(linkState);
  if (refusal) throw new Error(refusal);

  // The class must belong to this school. Without this check a visitor could
  // point an application at another school's class id.
  let className = "";
  if (data.classId) {
    const { data: klass } = await admin
      .from("classes")
      .select("id, name")
      .eq("id", data.classId)
      .eq("school_id", school.id)
      .maybeSingle();

    if (!klass) throw new Error("Please choose a class this school offers.");
    className = klass.name;
  }

  const row = {
    school_id: school.id,
    applicant_first_name: data.applicantFirstName,
    applicant_last_name: data.applicantLastName,
    date_of_birth: emptyToNull(data.dateOfBirth),
    gender: data.gender ?? null,
    class_id: data.classId ?? null,
    class_name: className,
    guardian_name: data.guardianName,
    guardian_email: data.guardianEmail.toLowerCase(),
    guardian_phone: emptyToNull(data.guardianPhone),
    address: emptyToNull(data.address),
    previous_school: emptyToNull(data.previousSchool),
    notes: emptyToNull(data.notes),
    status: "submitted" as const,
  };

  // A reference is eight random hex characters, so a clash is vanishingly rare
  // -- but the unique index would reject the insert if one ever happened, and a
  // guardian losing their application to a 23505 is not acceptable. Retry.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const applicationNumber = buildApplicationNumber();
    const { data: created, error } = await admin
      .from("admission_applications")
      .insert({ ...row, application_number: applicationNumber })
      .select("id, application_number")
      .single();

    if (error) {
      if (error.code === "23505") continue;
      throw new Error("We couldn't submit your application. Please try again.");
    }
    if (!created) throw new Error("We couldn't submit your application. Please try again.");

    await admin.from("admission_events").insert({
      application_id: created.id,
      school_id: school.id,
      author_name: "System",
      kind: "system",
      body: `Application received from the school website as ${created.application_number}.`,
    });

    await notifySchoolAdmins({
      schoolId: school.id,
      applicantName: `${data.applicantFirstName} ${data.applicantLastName}`,
    });

    return { applicationNumber: created.application_number };
  }

  throw new Error("We couldn't issue a reference for your application. Please try again.");
}

/** Tells the school's admins a fresh application has arrived. */
async function notifySchoolAdmins(input: {
  schoolId: string;
  applicantName: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("school_id", input.schoolId)
    .in("role", ["SCHOOL_OWNER", "SCHOOL_ADMIN"]);

  const recipients = [...new Set((data ?? []).map((r) => (r as { user_id: string }).user_id))];
  if (recipients.length === 0) return;

  await admin.from("notifications").insert(
    recipients.map((user_id) => ({
      user_id,
      school_id: input.schoolId,
      type: "admission_application_received" as const,
      title: "New admission application",
      message: `${input.applicantName} applied through the school website.`,
    })),
  );
}

// ---------------------------------------------------------------------------
// School-side reading
// ---------------------------------------------------------------------------

/** Every application for the school, newest first. */
export async function getAdmissionApplications(
  filter: { status?: AdmissionStatus } = {},
): Promise<AdmissionApplication[]> {
  const { schoolId } = await requireSchoolAdmin();
  const admin = createAdminClient();

  let query = admin
    .from("admission_applications")
    .select("*")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filter.status) query = query.eq("status", filter.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AdmissionApplication[];
}

/** Counts for the inbox header. */
export async function getAdmissionCounts(): Promise<Record<string, number>> {
  const { schoolId } = await requireSchoolAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("admission_applications")
    .select("status")
    .eq("school_id", schoolId);

  const counts: Record<string, number> = { all: 0 };
  for (const status of ADMISSION_STATUSES) counts[status] = 0;
  for (const row of (data ?? []) as { status: string }[]) {
    counts.all = (counts.all ?? 0) + 1;
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}

export type AdmissionDetail = {
  application: AdmissionApplication;
  events: AdmissionEvent[];
};

/** One application with its timeline. Scoped to the caller's school. */
export async function getAdmissionApplication(
  applicationId: string,
): Promise<AdmissionDetail | null> {
  const { schoolId } = await requireSchoolAdmin();
  const admin = createAdminClient();

  const { data: application } = await admin
    .from("admission_applications")
    .select("*")
    .eq("id", applicationId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!application) return null;

  const { data: events } = await admin
    .from("admission_events")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });

  return {
    application: application as AdmissionApplication,
    events: (events ?? []) as AdmissionEvent[],
  };
}

/**
 * Everything the printable offer letter needs: the application and the school
 * it is being made on behalf of.
 */
export type AdmissionLetterData = {
  application: AdmissionApplication;
  school: {
    name: string;
    motto: string | null;
    logo_url: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    phone: string | null;
    email: string | null;
  };
};

export async function getAdmissionLetterData(
  applicationId: string,
): Promise<AdmissionLetterData | null> {
  const { schoolId } = await requireSchoolAdmin();
  const admin = createAdminClient();

  const { data: application } = await admin
    .from("admission_applications")
    .select("*")
    .eq("id", applicationId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!application) return null;

  const { data: school } = await admin
    .from("schools")
    .select("name, motto, logo_url, address, city, state, phone, email")
    .eq("id", schoolId)
    .maybeSingle();

  if (!school) return null;

  return {
    application: application as AdmissionApplication,
    school,
  };
}

// ---------------------------------------------------------------------------
// School-side writes
// ---------------------------------------------------------------------------

async function authorName(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.full_name ?? "The school";
}

async function loadScopedApplication(
  applicationId: string,
  schoolId: string,
): Promise<AdmissionApplication> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("admission_applications")
    .select("*")
    .eq("id", applicationId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!data) throw new Error("That application is no longer available.");
  return data as AdmissionApplication;
}

async function recordEvent(input: {
  applicationId: string;
  schoolId: string;
  authorId: string;
  authorName: string;
  kind: string;
  body: string;
}): Promise<void> {
  const admin = createAdminClient();
  await admin.from("admission_events").insert({
    application_id: input.applicationId,
    school_id: input.schoolId,
    author_id: input.authorId,
    author_name: input.authorName,
    kind: input.kind,
    body: input.body,
  });
}

/** Moves an application through the workflow and records the move. */
export async function setAdmissionStatus(
  input: z.infer<typeof admissionStatusSchema>,
): Promise<void> {
  const data = admissionStatusSchema.parse(input);
  const { schoolId, userId } = await requireSchoolAdmin();
  const admin = createAdminClient();

  const application = await loadScopedApplication(data.applicationId, schoolId);
  const note = emptyToNull(data.note ?? null);

  const patches: Record<string, unknown> = { status: data.status };
  if (data.note !== undefined) patches.decision_note = note;
  // A decision is the point a human put their name to the outcome, so stamp who
  // and when for the offered / enrolled / rejected states.
  if (data.status === "offered" || data.status === "enrolled" || data.status === "rejected") {
    patches.reviewed_by = userId;
    patches.reviewed_at = new Date().toISOString();
  }

  const { error } = await admin
    .from("admission_applications")
    .update(patches)
    .eq("id", application.id)
    .eq("school_id", schoolId);

  if (error) throw new Error("We couldn't update this application.");

  const moving = `Status moved from ${admissionStatusLabel(application.status)} to ${admissionStatusLabel(data.status)}.`;
  await recordEvent({
    applicationId: application.id,
    schoolId,
    authorId: userId,
    authorName: await authorName(userId),
    kind: "status",
    body: note ? `${moving} ${note}` : moving,
  });
}

/** Records an entrance assessment score against an application. */
export async function recordEntranceScore(
  input: z.infer<typeof admissionScoreSchema>,
): Promise<void> {
  const data = admissionScoreSchema.parse(input);
  const { schoolId, userId } = await requireSchoolAdmin();
  const admin = createAdminClient();

  if (!isValidEntranceScore(data.score)) {
    throw new Error("Enter a score between 0 and 100.");
  }
  if (data.date && !DATE_PATTERN.test(data.date)) {
    throw new Error("Enter the assessment date as a calendar date.");
  }

  const application = await loadScopedApplication(data.applicationId, schoolId);

  const { error } = await admin
    .from("admission_applications")
    .update({
      entrance_score: data.score,
      entrance_date: emptyToNull(data.date ?? null),
    })
    .eq("id", application.id)
    .eq("school_id", schoolId);

  if (error) throw new Error("We couldn't save the entrance score.");

  await recordEvent({
    applicationId: application.id,
    schoolId,
    authorId: userId,
    authorName: await authorName(userId),
    kind: "score",
    body: `Entrance score recorded as ${data.score}%.`,
  });
}

/** Adds a free-text note to an application's timeline. */
export async function addAdmissionNote(
  input: z.infer<typeof admissionNoteSchema>,
): Promise<void> {
  const data = admissionNoteSchema.parse(input);
  const { schoolId, userId } = await requireSchoolAdmin();

  const application = await loadScopedApplication(data.applicationId, schoolId);

  await recordEvent({
    applicationId: application.id,
    schoolId,
    authorId: userId,
    authorName: await authorName(userId),
    kind: "note",
    body: data.body,
  });
}

/** Removes an application and its timeline. */
export async function deleteAdmissionApplication(applicationId: string): Promise<void> {
  const { schoolId } = await requireSchoolAdmin();
  const admin = createAdminClient();

  const application = await loadScopedApplication(applicationId, schoolId);
  const { error } = await admin
    .from("admission_applications")
    .delete()
    .eq("id", application.id)
    .eq("school_id", schoolId);

  if (error) throw new Error("We couldn't delete this application.");
}

// ---------------------------------------------------------------------------
// Admission settings
// ---------------------------------------------------------------------------

/** A school with no settings row: link off, no window, no fee. */
const DEFAULT_SETTINGS: AdmissionSettings = {
  school_id: "",
  enabled: false,
  opens_at: null,
  closes_at: null,
  intake_label: null,
  intro_message: null,
  application_fee_amount: null,
  application_fee_currency: "NGN",
  fee_note: null,
  updated_by: null,
  created_at: "",
  updated_at: "",
};

const SETTINGS_COLUMNS =
  "school_id, enabled, opens_at, closes_at, intake_label, intro_message, application_fee_amount, application_fee_currency, fee_note, updated_by, created_at, updated_at";

/**
 * The public admissions link's state, resolved for a school.
 *
 * `status` is what a visitor should see right now:
 *   - "disabled":    the link is off (or the school never set one up)
 *   - "not_open_yet": on, but the window has not started
 *   - "closed":      on, but the window has ended
 *   - "open":        applications are being accepted
 */
export type AdmissionLinkState = {
  status: "disabled" | "not_open_yet" | "closed" | "open";
  opensAt: string | null;
  closesAt: string | null;
  intakeLabel: string | null;
  introMessage: string | null;
  fee: { amount: number; currency: string; note: string | null } | null;
};

function toLinkState(settings: AdmissionSettings, now = new Date()): AdmissionLinkState {
  const fee =
    settings.application_fee_amount === null
      ? null
      : {
          amount: Number(settings.application_fee_amount),
          currency: settings.application_fee_currency,
          note: settings.fee_note,
        };

  const shared = {
    opensAt: settings.opens_at,
    closesAt: settings.closes_at,
    intakeLabel: settings.intake_label,
    introMessage: settings.intro_message,
    fee,
  };

  if (!settings.enabled) return { status: "disabled", ...shared };

  const nowMs = now.getTime();
  if (settings.opens_at && nowMs < new Date(settings.opens_at).getTime()) {
    return { status: "not_open_yet", ...shared };
  }
  if (settings.closes_at && nowMs > new Date(settings.closes_at).getTime()) {
    return { status: "closed", ...shared };
  }
  return { status: "open", ...shared };
}

/**
 * Reads the school's admission settings for an admin-facing page. Falls back
 * to the "link off" defaults when the school has no row, so the settings form
 * is always populated rather than erroring.
 */
export async function getAdmissionSettings(): Promise<AdmissionSettings> {
  const { schoolId } = await requireSchoolAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("admission_settings")
    .select(SETTINGS_COLUMNS)
    .eq("school_id", schoolId)
    .maybeSingle();

  return (data as AdmissionSettings | null) ?? { ...DEFAULT_SETTINGS, school_id: schoolId };
}

/**
 * Resolves the public link state by school slug. This is the read the public
 * admissions page makes, and it cannot go through `requireSchoolAdmin` because
 * the caller is a signed-out visitor -- so it is scoped by the slug the page
 * already resolved to a live school.
 */
export async function getAdmissionLinkStateBySlug(slug: string): Promise<AdmissionLinkState> {
  const admin = createAdminClient();
  const { data: school } = await admin
    .from("schools")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!school) return toLinkState({ ...DEFAULT_SETTINGS, school_id: "" });

  const { data } = await admin
    .from("admission_settings")
    .select(SETTINGS_COLUMNS)
    .eq("school_id", school.id)
    .maybeSingle();

  return toLinkState((data as AdmissionSettings | null) ?? { ...DEFAULT_SETTINGS, school_id: school.id });
}

/**
 * Creates or updates the school's admission settings. Upserts on `school_id`
 * because there is exactly one row per school and the first save is an insert.
 *
 * Writes through the service role: there is no INSERT/UPDATE policy on the
 * table (see 0034), so a leaked anon key cannot open a school's admission
 * window or change its fee. The gate is `requireSchoolAdmin` above it.
 */
export async function updateAdmissionSettings(
  input: z.input<typeof admissionSettingsSchema>,
): Promise<void> {
  const data = admissionSettingsSchema.parse(input);
  const { schoolId, userId } = await requireSchoolAdmin();
  const admin = createAdminClient();

  const { error } = await admin.from("admission_settings").upsert(
    {
      school_id: schoolId,
      enabled: data.enabled,
      opens_at: data.opensAt,
      closes_at: data.closesAt,
      intake_label: emptyToNull(data.intakeLabel ?? null),
      intro_message: emptyToNull(data.introMessage ?? null),
      // A blank fee is "no fee", not "zero fee" -- zero would print "Free" as
      // "₦0" and read as a real amount.
      application_fee_amount: data.applicationFeeAmount ?? null,
      application_fee_currency: data.applicationFeeCurrency,
      fee_note: emptyToNull(data.feeNote ?? null),
      updated_by: userId,
    },
    { onConflict: "school_id" },
  );

  if (error) throw new Error("We couldn't save the admission settings.");
}

/**
 * Whether a public application should be accepted for a school right now.
 *
 * Returns a human-readable refusal when it is not, and `null` when it is. The
 * refusal is what the public form shows a visitor who lands on a link that is
 * off, not open yet, or already closed.
 */
export function admissionLinkRefusal(state: AdmissionLinkState): string | null {
  if (state.status === "open") return null;
  if (state.status === "disabled") {
    return "This school is not accepting applications right now.";
  }
  if (state.status === "not_open_yet") {
    const when = state.opensAt
      ? ` on ${new Date(state.opensAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
      : "";
    return `Applications for this intake open${when}. Please check back then.`;
  }
  const when = state.closesAt
    ? ` on ${new Date(state.closesAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
    : "";
  return `The application window for this intake closed${when}. Please contact the school directly.`;
}
