import { z } from "zod";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireSchoolAdmin } from "@/services/shared";
import { asArray } from "@/lib/embed";
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUSES,
  complaintCategoryLabel,
} from "@/lib/complaint-labels";
import type { Complaint, ComplaintMessage } from "@/types/database";

export const complaintSchema = z.object({
  subject: z.string().trim().min(4, "Give your complaint a short subject").max(160),
  category: z.enum(COMPLAINT_CATEGORIES).default("other"),
  body: z.string().trim().min(10, "Please describe the issue").max(4000),
  // Optional: name the child this is about, so the admin knows the context.
  studentId: z.string().uuid().optional().nullable(),
});

export const complaintReplySchema = z.object({
  complaintId: z.string().uuid(),
  body: z.string().trim().min(1, "Write a message").max(4000),
});

export const complaintStatusSchema = z.object({
  complaintId: z.string().uuid(),
  status: z.enum(COMPLAINT_STATUSES),
  assignedTo: z.string().uuid().nullable().optional(),
});

export type ComplaintWithMessages = Complaint & {
  messages: ComplaintMessage[];
  lastMessageAt: string;
};

export type SchoolComplaint = Complaint & {
  messageCount: number;
  lastMessageAt: string;
  assignedToName: string | null;
};

// Re-exported so server code can keep importing labels from here, while client
// components import them from @/lib/complaint-labels to avoid pulling this
// module's server-only dependencies into the browser bundle.
export { complaintCategoryLabel, complaintStatusLabel } from "@/lib/complaint-labels";

// ---------------------------------------------------------------------------
// Raising a complaint
// ---------------------------------------------------------------------------

/**
 * Opens a complaint thread on the caller's behalf.
 *
 * The author is taken from the session, never from the form, so a parent cannot
 * lodge a complaint in someone else's name. The thread and its opening message
 * are written together, and the thread is removed again if the message cannot be
 * written, so a complaint never survives with no body attached to it.
 */
export async function createComplaint(
  input: z.infer<typeof complaintSchema>,
): Promise<{ complaintId: string }> {
  const data = complaintSchema.parse(input);
  const context = await getAuthContext();
  if (!context.user) throw new Error("Please sign in to raise a complaint.");

  // Prefer the parent's own school. Someone can hold several roles across
  // several schools, and taking memberships[0] would file a parent's complaint
  // against whichever school happened to sort first -- including a school where
  // they only teach.
  const membership =
    context.memberships.find((m) => m.role === "PARENT") ?? context.memberships[0];
  if (!membership) throw new Error("You are not linked to a school yet.");

  const role = membership.role ?? "PARENT";
  const admin = createAdminClient();

  // RLS would reject a name that does not match the profile anyway; reading it
  // here keeps the inbox list stable if a parent later renames themselves.
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", context.user.id)
    .maybeSingle();

  const { data: created, error } = await admin
    .from("complaints")
    .insert({
      school_id: membership.school.id,
      raised_by: context.user.id,
      raised_by_name: profile?.full_name ?? "Parent",
      raised_by_role: role,
      category: data.category,
      subject: data.subject,
    })
    .select("id")
    .single();

  if (error || !created) throw new Error("We couldn't send your complaint. Please try again.");

  const { error: messageError } = await admin.from("complaint_messages").insert({
    complaint_id: created.id,
    author_id: context.user.id,
    author_name: profile?.full_name ?? "Parent",
    is_from_school: false,
    body: data.body,
  });

  if (messageError) {
    // Do not leave an empty thread behind for the admin to chase.
    await admin.from("complaints").delete().eq("id", created.id);
    throw new Error("We couldn't send your complaint. Please try again.");
  }

  await notifySchoolAdmins({
    schoolId: membership.school.id,
    subject: data.subject,
    category: data.category,
    fromName: profile?.full_name ?? "A parent",
  });

  return { complaintId: created.id };
}

/** Tells the school's admins a complaint has arrived. */
async function notifySchoolAdmins(input: {
  schoolId: string;
  subject: string;
  category: string;
  fromName: string;
  /** Set when the parent added a message to a thread that already exists. */
  isFollowUp?: boolean;
}): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_roles")
    .select("user_id, role")
    .eq("school_id", input.schoolId)
    .in("role", ["SCHOOL_OWNER", "SCHOOL_ADMIN"]);

  const recipients = [...new Set((data ?? []).map((r) => (r as { user_id: string }).user_id))];
  if (recipients.length === 0) return;

  await admin.from("notifications").insert(
    recipients.map((user_id) => ({
      user_id,
      school_id: input.schoolId,
      type: "system" as const,
      title: input.isFollowUp
        ? "A parent added to a complaint"
        : `New ${complaintCategoryLabel(input.category).toLowerCase()} complaint`,
      message: `${input.fromName}: ${input.subject}`,
    })),
  );
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** The caller's own threads, newest first. */
export async function getMyComplaints(userId: string): Promise<ComplaintWithMessages[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("complaints")
    .select(
      "*, complaint_messages(id, complaint_id, author_id, author_name, is_from_school, body, created_at)",
    )
    .eq("raised_by", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((row) => toThreadWithMessages(row as Complaint & {
    complaint_messages: ComplaintMessage[] | ComplaintMessage | null;
  }));
}

/** One thread, for the detail view. RLS decides who can see it. */
export async function getComplaintThread(
  complaintId: string,
): Promise<ComplaintWithMessages | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("complaints")
    .select(
      "*, complaint_messages(id, complaint_id, author_id, author_name, is_from_school, body, created_at)",
    )
    .eq("id", complaintId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return toThreadWithMessages(data as Complaint & {
    complaint_messages: ComplaintMessage[] | ComplaintMessage | null;
  });
}

function toThreadWithMessages(
  row: Complaint & { complaint_messages: ComplaintMessage[] | ComplaintMessage | null },
): ComplaintWithMessages {
  // PostgREST returns an embedded one-to-many as an array, but a single row
  // comes back unwrapped -- asArray covers both.
  const messages = asArray(row.complaint_messages).sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  const complaint: Complaint = {
    id: row.id,
    school_id: row.school_id,
    raised_by: row.raised_by,
    raised_by_name: row.raised_by_name,
    raised_by_role: row.raised_by_role,
    category: row.category,
    subject: row.subject,
    status: row.status,
    assigned_to: row.assigned_to,
    created_at: row.created_at,
    updated_at: row.updated_at,
    resolved_at: row.resolved_at,
  };
  return {
    ...complaint,
    messages,
    lastMessageAt: messages.at(-1)?.created_at ?? complaint.created_at,
  };
}

/** Every complaint for the school, for the admin inbox. */
export async function getSchoolComplaints(
  filter: { status?: string } = {},
): Promise<SchoolComplaint[]> {
  const { schoolId } = await requireSchoolAdmin();
  const admin = createAdminClient();

  let query = admin
    .from("complaints")
    .select(
      "*, complaint_messages(id, created_at), profiles!complaints_assigned_to_fkey(full_name)",
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filter.status && filter.status !== "all") {
    query = query.eq("status", filter.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => {
      const r = row as Complaint & {
        complaint_messages: { id: string; created_at: string }[] | null;
        profiles: { full_name: string }[] | null;
      };
      // PostgREST does not promise an order for an embedded list, so the
      // "last" message has to be found rather than assumed to be at the end.
      const messages = asArray(r.complaint_messages)
        .slice()
        .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
      return {
        ...r,
        messageCount: messages.length,
        lastMessageAt: messages.at(-1)?.created_at ?? r.created_at,
        assignedToName: asArray(r.profiles)[0]?.full_name ?? null,
      } as SchoolComplaint;
    })
    // Newest activity first: a reply on an old complaint is what an admin needs
    // to see, not the order in which the complaints were originally filed.
    .sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
}

/** Counts for the inbox header. */
export async function getComplaintCounts(): Promise<Record<string, number>> {
  const { schoolId } = await requireSchoolAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("complaints")
    .select("status", { count: "exact" })
    .eq("school_id", schoolId);

  const counts: Record<string, number> = { all: 0, open: 0, in_progress: 0, resolved: 0 };
  for (const row of (data ?? []) as { status: string }[]) {
    counts.all = (counts.all ?? 0) + 1;
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Replying and triage
// ---------------------------------------------------------------------------

/**
 * Adds a message to a thread.
 *
 * `is_from_school` is decided from the caller's role, not from the form: a
 * parent must not be able to post a message that reads as an official reply.
 */
export async function replyToComplaint(
  input: z.infer<typeof complaintReplySchema>,
): Promise<void> {
  const data = complaintReplySchema.parse(input);
  const context = await getAuthContext();
  if (!context.user) throw new Error("Please sign in to reply.");

  const isSchool = context.memberships.some(
    (m) => m.role === "SCHOOL_OWNER" || m.role === "SCHOOL_ADMIN",
  );

  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("full_name")
    .eq("id", context.user.id)
    .maybeSingle();

  // Insert as the signed-in user, not as the service role. RLS is the only
  // thing that knows who may read this thread, and the service role bypasses
  // it -- writing through it would let anyone who guessed a complaint id post
  // into a thread belonging to another parent.
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("complaint_messages").insert({
    complaint_id: data.complaintId,
    author_id: context.user.id,
    author_name: profile?.full_name ?? "Unknown",
    is_from_school: isSchool,
    body: data.body,
  });

  // An RLS rejection means the caller could not see the thread, which is the
  // same outcome as a thread that does not exist. Say so instead of
  // disclosing that some other complaint id is real.
  if (error) {
    if (error.code === "42501") {
      throw new Error("You do not have access to that conversation.");
    }
    throw new Error("We couldn't send your reply.");
  }

  // A school reply on an untouched thread means work has started.
  if (isSchool) {
    const admin = createAdminClient();
    await admin
      .from("complaints")
      .update({ status: "in_progress" })
      .eq("id", data.complaintId)
      .eq("status", "open");

    // The parent is not looking at this page, so tell them the school replied.
    // Without this a reply is invisible until the parent happens to check.
    const { data: thread } = await admin
      .from("complaints")
      .select("raised_by, school_id, subject")
      .eq("id", data.complaintId)
      .maybeSingle();

    if (thread && thread.raised_by !== context.user.id) {
      await admin.from("notifications").insert({
        user_id: thread.raised_by,
        school_id: thread.school_id,
        type: "system" as const,
        title: "The school replied to your complaint",
        message: thread.subject,
      });
    }
  } else {
    // A parent replying keeps the thread alive on the school's side too.
    const admin = createAdminClient();
    const { data: thread } = await admin
      .from("complaints")
      .select("raised_by, school_id, subject, category")
      .eq("id", data.complaintId)
      .maybeSingle();

    if (thread) {
      await notifySchoolAdmins({
        schoolId: thread.school_id,
        subject: thread.subject,
        category: thread.category,
        fromName: profile?.full_name ?? "A parent",
        // The subject line already identifies the thread; this is a nudge
        // that a parent is waiting on a response.
        isFollowUp: true,
      });
    }
  }
}

/** Moves a thread through open / in_progress / resolved, and assigns it. */
export async function setComplaintStatus(
  input: z.infer<typeof complaintStatusSchema>,
): Promise<void> {
  const data = complaintStatusSchema.parse(input);
  const { schoolId, userId } = await requireSchoolAdmin();
  const admin = createAdminClient();

  const patches: Record<string, unknown> = { status: data.status };
  if (data.assignedTo !== undefined) patches.assigned_to = data.assignedTo;
  // Stamp the resolution so the inbox can show how long a thread was handled.
  patches.resolved_at = data.status === "resolved" ? new Date().toISOString() : null;

  if (data.assignedTo) {
    // can_access_complaint treats the assignee as a thread participant, so an
    // unchecked id here would hand a parent's complaint to any account on the
    // platform. Only staff of this school may be assigned.
    const { data: assignee } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("school_id", schoolId)
      .eq("user_id", data.assignedTo)
      .in("role", ["SCHOOL_OWNER", "SCHOOL_ADMIN", "PRINCIPAL"])
      .maybeSingle();

    if (!assignee) {
      throw new Error("You can only assign a complaint to staff of this school.");
    }
  }

  const { error } = await admin
    .from("complaints")
    .update(patches)
    .eq("id", data.complaintId)
    .eq("school_id", schoolId);

  if (error) throw new Error("We couldn't update this complaint.");

  if (data.assignedTo && data.assignedTo !== userId) {
    await admin.from("notifications").insert({
      user_id: data.assignedTo,
      school_id: schoolId,
      type: "system",
      title: "A complaint was assigned to you",
      message: "Open the complaints inbox to see it.",
    });
  }
}

/** A raiser withdrawing a thread while it is still open. */
export async function withdrawComplaint(complaintId: string): Promise<void> {
  const context = await getAuthContext();
  if (!context.user) throw new Error("Please sign in.");

  // The where-clause is the guard here, so the service role cannot widen it:
  // only the caller's own thread can be touched, and only while it is open.
  const { data, error } = await createAdminClient()
    .from("complaints")
    .delete()
    .eq("id", complaintId)
    .eq("raised_by", context.user.id)
    .eq("status", "open")
    .select("id");

  if (error) throw new Error("We couldn't withdraw this complaint.");

  // The school may have already started work on it, in which case the delete
  // matched nothing. Report that rather than telling the parent it is gone.
  if (!data || data.length === 0) {
    throw new Error(
      "This complaint can no longer be withdrawn because the school has already started work on it.",
    );
  }
}

/** The staff an admin can assign a complaint to. */
export async function getAssignableStaff(
  schoolId: string,
): Promise<{ id: string; name: string; role: string }[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_roles")
    .select("user_id, role, profiles(full_name)")
    .eq("school_id", schoolId)
    .in("role", ["SCHOOL_OWNER", "SCHOOL_ADMIN", "PRINCIPAL"]);

  return (data ?? []).flatMap((row) => {
    const r = row as { user_id: string; role: string; profiles: { full_name: string }[] | null };
    const name = asArray(r.profiles)[0]?.full_name;
    return name ? [{ id: r.user_id, name, role: r.role }] : [];
  });
}
