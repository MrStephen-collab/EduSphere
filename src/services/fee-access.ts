import { revalidatePath } from "next/cache";
import {
  evaluateLearningAccess,
  normaliseThreshold,
  standingFromInvoices,
  type LearningAccessDecision,
} from "@/lib/fee-gate";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSchoolAdmin } from "@/services/shared";

/**
 * Reads a school's fee gate and a student's standing under it.
 *
 * The reads use the request-scoped client, not the service role, so the answer
 * comes back through the same row-level policies as the fees page. A bursar who
 * cannot see an invoice cannot unlock a student's materials by switching the
 * threshold to zero, because that would make the gate depend on a setting rather
 * than on money they are entitled to see.
 */

/** The student's standing, plus what it would take to clear the gate. */
export type StudentLearningAccess = LearningAccessDecision & {
  /** True when the school has the gate switched on at all. */
  gateEnabled: boolean;
};

export async function getSchoolLearningThreshold(schoolId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("schools")
    .select("learning_access_threshold_pct")
    .eq("id", schoolId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  // A school created before 0027, or a read that raced the migration, is treated
  // as "no gate" rather than as a crash on the student's lesson page.
  return normaliseThreshold(data?.learning_access_threshold_pct ?? 0);
}

/**
 * The student's standing against their school's gate.
 *
 * Waived and void invoices never reach this sum: `standingFromInvoices` reuses
 * the fees page's own totals, so a bursary raises a student's paid share without
 * any separate exemption list to keep in step with the money.
 */
export async function getStudentLearningAccess(
  schoolId: string,
  studentId: string,
): Promise<StudentLearningAccess> {
  const supabase = await createSupabaseServerClient();
  const [threshold, invoices] = await Promise.all([
    getSchoolLearningThreshold(schoolId),
    supabase
      .from("fee_invoices")
      .select("amount, amount_paid, status")
      .eq("school_id", schoolId)
      .eq("student_id", studentId),
  ]);

  if (invoices.error) throw new Error(invoices.error.message);

  const decision = evaluateLearningAccess(
    threshold,
    standingFromInvoices(invoices.data ?? []),
  );

  return { ...decision, gateEnabled: threshold > 0 };
}

/**
 * Switches the gate on or off for this school.
 *
 * Zero is the off position rather than a separate boolean, so the one setting a
 * bursar sees is the setting that matters: 0 means no threshold, 100 means the
 * whole bill before materials open.
 */
export async function setSchoolLearningThreshold(
  input: { schoolId: string; thresholdPct: number | string },
): Promise<{ thresholdPct: number }> {
  const { schoolId } = await requireSchoolAdmin();
  if (schoolId !== input.schoolId) {
    throw new Error("You can only change this for your own school.");
  }

  const thresholdPct = normaliseThreshold(input.thresholdPct);
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("schools")
    .update({ learning_access_threshold_pct: thresholdPct })
    .eq("id", schoolId);

  if (error) throw new Error(error.message);

  revalidatePath("/school/fees");
  revalidatePath("/student/courses", "layout");
  revalidatePath("/student/fees");

  return { thresholdPct };
}
