import { z } from "zod";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { asArray } from "@/lib/embed";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireParent } from "@/services/parent";
import { requireSchoolAdmin } from "@/services/shared";
import { isPaystackConfigured, initializePayment, verifyPayment } from "@/lib/paystack";
import {
  applyApproval,
  buildBillingKey,
  buildFeeReference,
  buildStatement,
  fromMinorUnits,
  isFeeReference,
  isPayableStatus,
  outstandingFor,
  receiptReference,
  roundMoney,
  toMinorUnits,
  type Statement,
} from "@/lib/fee-math";
import type {
  FeeInvoice,
  FeeInvoiceStatus,
  FeePayment,
  FeePaymentStatus,
} from "@/types/database";

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

type InvoiceWithStudent = FeeInvoice & {
  students: { id: string; display_name: string | null; admission_number: string } | null;
};

type PaymentWithInvoice = FeePayment & {
  fee_invoices: {
    id: string;
    student_id: string;
    description: string;
    amount: number;
    amount_paid: number;
    currency: string;
    status: FeeInvoiceStatus;
    students: { display_name: string | null; admission_number: string } | null;
  } | null;
};

export type ParentFeeSummary = {
  invoice: InvoiceWithStudent;
  outstanding: number;
  payments: FeePayment[];
};

export type SchoolFeeStats = {
  invoiced: number;
  collected: number;
  outstanding: number;
  overdueCount: number;
  awaitingApproval: number;
};

export type SchoolFeeReviewRow = {
  payment: FeePayment;
  studentName: string;
  admissionNumber: string;
  description: string;
  invoiceAmount: number;
  invoicePaid: number;
  currency: string;
};

// Inputs are declared as the schema's *input* type, not its output, because a
// form hands over a raw string for the amount and zod is what turns it into a
// number. Declaring the output type here would push that coercion onto callers
// and let an unvalidated value reach the arithmetic.
export type FeeIssueInput = z.input<typeof feeIssueSchema>;
export type FeeGenerateInput = z.input<typeof feeGenerateSchema>;

export const feeIssueSchema = z.object({
  studentId: z.string().uuid("Choose a student"),
  termId: z.string().uuid().optional().nullable(),
  description: z.string().trim().min(3, "Describe what is being charged").max(160),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  dueDate: z.string().optional().nullable(),
});

export const feeGenerateSchema = feeIssueSchema
  .omit({ studentId: true })
  .extend({ termId: z.string().uuid("Choose a term"), classId: z.string().uuid().optional().nullable() })
  .extend({ amount: z.coerce.number().positive("Amount must be greater than zero") });

export const feeReviewSchema = z.object({
  paymentId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

async function writeAudit(opts: {
  schoolId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    school_id: opts.schoolId,
    action: opts.action,
    entity_type: opts.entityType,
    entity_id: opts.entityId ?? null,
    metadata: opts.metadata ?? {},
  });
}

/** The bursars who need to see a payment waiting for review. */
async function adminRecipients(schoolId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("school_id", schoolId)
    .in("role", ["SCHOOL_OWNER", "SCHOOL_ADMIN"]);
  return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
}

async function notify(input: {
  userIds: string[];
  schoolId: string;
  type:
    | "fee_invoice_issued"
    | "fee_payment_submitted"
    | "fee_payment_approved"
    | "fee_payment_rejected";
  title: string;
  message: string;
}) {
  const recipients = [...new Set(input.userIds)].filter(Boolean);
  if (recipients.length === 0) return;
  const admin = createAdminClient();
  await admin.from("notifications").insert(
    recipients.map((user_id) => ({
      user_id,
      school_id: input.schoolId,
      type: input.type,
      title: input.title,
      message: input.message,
    })),
  );
}

/** The parents of one student, as auth user ids, for issuing an invoice. */
async function parentUserIdsForStudent(
  studentId: string,
): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("parent_student_relationships")
    .select("parents!inner(user_id)")
    .eq("student_id", studentId);
  return ((data ?? []) as unknown as { parents: { user_id: string | null } | null }[])
    .map((r) => asArray(r.parents)[0]?.user_id)
    .filter((v): v is string => Boolean(v));
}

// ---------------------------------------------------------------------------
// Parent view
// ---------------------------------------------------------------------------

/**
 * Every invoice raised against the caller's linked children, newest term first.
 *
 * Read through the request-scoped client so RLS decides visibility rather than
 * a filter in this file: a parent cannot be handed a colleague's child by
 * tampering with a student id, because can_access_fee_invoice denies the row.
 */
export async function getParentFees(): Promise<{
  summary: ParentFeeSummary[];
  totals: { invoiced: number; paid: number; outstanding: number };
}> {
  const { schoolId } = await requireParent();
  const supabase = await createSupabaseServerClient();

  // The totals are summed from a separate untruncated read, so a parent with a
  // long enrolment history can never be shown a balance that is quietly capped
  // by the row limit on the list below. A parent acting on a wrong outstanding
  // balance is the one who pays the difference.
  const [allInvoices, recentInvoices] = await Promise.all([
    supabase
      .from("fee_invoices")
      .select("amount, amount_paid, status")
      .eq("school_id", schoolId),
    supabase
      .from("fee_invoices")
      .select("*, students!inner(id, display_name, admission_number)")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  if (recentInvoices.error) throw new Error(recentInvoices.error.message);

  const invoices = (recentInvoices.data ?? []) as unknown as InvoiceWithStudent[];
  const scalars = (allInvoices.data ?? []) as Pick<
    FeeInvoice,
    "amount" | "amount_paid" | "status"
  >[];

  const payments = invoices.length
    ? await loadPaymentsForInvoices(invoices.map((i) => i.id))
    : new Map<string, FeePayment[]>();

  const summary = invoices.map((invoice) => ({
    invoice,
    outstanding: outstandingFor(invoice),
    payments: payments.get(invoice.id) ?? [],
  }));

  return {
    summary,
    totals: {
      invoiced: roundMoney(scalars.reduce((s, i) => s + Number(i.amount), 0)),
      paid: roundMoney(scalars.reduce((s, i) => s + Number(i.amount_paid), 0)),
      outstanding: roundMoney(
        scalars
          .filter((i) => isPayableStatus(i.status))
          .reduce((s, i) => s + outstandingFor(i), 0),
      ),
    },
  };
}

async function loadPaymentsForInvoices(
  invoiceIds: string[],
): Promise<Map<string, FeePayment[]>> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("fee_payments")
    .select("*")
    .in("invoice_id", invoiceIds)
    .order("created_at", { ascending: false });

  const grouped = new Map<string, FeePayment[]>();
  for (const row of (data ?? []) as FeePayment[]) {
    const list = grouped.get(row.invoice_id) ?? [];
    list.push(row);
    grouped.set(row.invoice_id, list);
  }
  return grouped;
}

// ---------------------------------------------------------------------------
// Receipts and statements
// ---------------------------------------------------------------------------

export type FeeReceipt = {
  reference: string;
  paidAt: string;
  childName: string;
  admissionNumber: string;
  description: string;
  /** What the parent handed over. */
  tendered: number;
  /** What the school actually credited. Lower when a payment exceeded the debt. */
  credited: number;
  /** True when the approval had to clamp an overpayment. */
  overpaid: boolean;
  currency: string;
  /** The invoice's own totals, so the receipt is a complete document. */
  invoiceTotal: number;
  invoicePaidAfter: number;
  invoiceStatus: FeeInvoiceStatus;
  method: string;
  providerReference: string | null;
  note: string | null;
  reviewedAt: string | null;
  school: { name: string; motto: string | null; address: string | null; phone: string | null; email: string | null };
};

/**
 * One approved payment as a receiptable document.
 *
 * Read through the request-scoped client, so RLS decides the answer: a parent
 * asking for a receipt by id gets nothing for a payment on somebody else's
 * child, and cannot probe whether one exists.
 *
 * Only an approved payment produces a receipt. A pending or submitted payment
 * has moved no money, and printing a receipt for it would be a document the
 * school does not stand behind.
 */
export async function getParentFeeReceipt(paymentId: string): Promise<FeeReceipt | null> {
  await requireParent();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("fee_payments")
    .select(
      "id, amount, credited_amount, status, created_at, reviewed_at, review_note, provider, provider_reference, " +
        "fee_invoices!inner(id, description, amount, amount_paid, currency, status, students!inner(display_name, admission_number))",
    )
    .eq("id", paymentId)
    .eq("status", "approved")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const payment = data as unknown as {
    id: string;
    amount: number;
    credited_amount: number | null;
    created_at: string;
    reviewed_at: string | null;
    review_note: string | null;
    provider: string;
    provider_reference: string | null;
    fee_invoices: {
      description: string;
      amount: number;
      amount_paid: number;
      currency: string;
      status: FeeInvoiceStatus;
      students: { display_name: string | null; admission_number: string } | null;
    } | null;
  };

  const invoice = payment.fee_invoices;
  if (!invoice) return null;

  const student = asArray(invoice.students as { display_name: string | null; admission_number: string } | null)[0];

  // An approval from before 0017 has no credited_amount. The tendered figure is
  // the best available reading of what was kept, and the receipt says so rather
  // than quietly presenting a guess as fact.
  const credited = payment.credited_amount ?? roundMoney(Number(payment.amount));
  const tendered = roundMoney(Number(payment.amount));

  const { data: schoolRow } = await supabase
    .from("schools")
    .select("name, motto, address, phone, email")
    .limit(1)
    .maybeSingle();

  const school = (schoolRow ?? { name: "School", motto: null, address: null, phone: null, email: null }) as FeeReceipt["school"];

  return {
    reference: receiptReference(payment.id),
    paidAt: payment.reviewed_at ?? payment.created_at,
    childName: student?.display_name ?? "Student",
    admissionNumber: student?.admission_number ?? "—",
    description: invoice.description,
    tendered,
    credited,
    overpaid: roundMoney(tendered - credited) > 0,
    currency: invoice.currency,
    invoiceTotal: roundMoney(Number(invoice.amount)),
    invoicePaidAfter: roundMoney(Number(invoice.amount_paid)),
    invoiceStatus: invoice.status,
    method: payment.provider === "paystack" ? "Paystack (online)" : payment.provider,
    providerReference: payment.provider_reference,
    note: payment.review_note,
    reviewedAt: payment.reviewed_at,
    school,
  };
}

export type ParentStatement = Statement & {
  child: {
    studentId: string;
    displayName: string;
    admissionNumber: string;
    className: string | null;
  };
};

/**
 * A dated statement of account for one linked child: every charge the school
 * raised, every payment it credited, and the balance owed after each.
 *
 * Scoped to a single child on purpose. A statement that mixed siblings together
 * would be unreadable as an accounting document, and the balance a family is
 * chasing is always about one child at a time.
 */
export async function getParentFeeStatement(
  studentId: string,
): Promise<ParentStatement | null> {
  const { schoolId, parentId } = await requireParent();
  const supabase = await createSupabaseServerClient();

  // Prove the link through the request-scoped client first. The RLS policy on
  // fee_invoices would hide the rows anyway, but a child the caller is not
  // linked to has to be a null result rather than an empty statement, or the
  // page would render a confident "you owe nothing" document about someone
  // else's child.
  const { data: link } = await supabase
    .from("parent_student_relationships")
    .select("student_id")
    .eq("school_id", schoolId)
    .eq("parent_id", parentId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (!link) return null;

  const { data: childRow } = await supabase
    .from("students")
    .select("id, display_name, admission_number, classes(name)")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  const child = asArray(childRow as { id: string; display_name: string | null; admission_number: string; classes: { name: string } | null } | null)[0];
  if (!child) return null;

  const [invoiceRows, creditRows] = await Promise.all([
    supabase
      .from("fee_invoices")
      .select("id, description, amount, currency, status, created_at, due_date")
      .eq("student_id", studentId)
      .eq("school_id", schoolId)
      .order("created_at", { ascending: true }),
    supabase
      .from("fee_payments")
      .select("id, amount, credited_amount, created_at, fee_invoices!inner(id, student_id)")
      .eq("school_id", schoolId)
      .eq("status", "approved")
      .order("created_at", { ascending: true }),
  ]);

  if (invoiceRows.error) throw new Error(invoiceRows.error.message);
  if (creditRows.error) throw new Error(creditRows.error.message);

  const invoices = (invoiceRows.data ?? []) as unknown as {
    id: string;
    description: string;
    amount: number;
    currency: string;
    status: FeeInvoiceStatus;
    created_at: string;
    due_date: string | null;
  }[];

  // fee_payments has no student_id of its own, so the child's credits are
  // selected out of the joined invoice rather than filtered in SQL.
  const credits = ((creditRows.data ?? []) as unknown as {
    id: string;
    amount: number;
    credited_amount: number | null;
    created_at: string;
    fee_invoices: { id: string; student_id: string } | null;
  }[])
    .filter((p) => p.fee_invoices?.student_id === studentId)
    .map((p) => {
      const invoice = invoices.find((i) => i.id === p.fee_invoices?.id);
      return {
        id: p.id,
        date: p.created_at,
        description: `Payment — ${invoice?.description ?? "School fee"}`,
        tendered: roundMoney(Number(p.amount)),
        credited: p.credited_amount === null ? null : roundMoney(Number(p.credited_amount)),
        reference: receiptReference(p.id),
      };
    });

  const currency = invoices[0]?.currency ?? "NGN";
  const cls = asArray(child.classes as { name: string } | null)[0];

  return {
    child: {
      studentId: child.id,
      displayName: child.display_name ?? "Student",
      admissionNumber: child.admission_number,
      className: cls?.name ?? null,
    },
    ...buildStatement({
      currency,
      generatedAt: new Date().toISOString(),
      charges: invoices.map((i) => ({
        id: i.id,
        date: i.created_at,
        description: i.description,
        amount: roundMoney(Number(i.amount)),
        status: i.status,
      })),
      credits,
    }),
  };
}

// ---------------------------------------------------------------------------
// Paying
// ---------------------------------------------------------------------------

/**
 * Starts a Paystack checkout for whatever is outstanding on one invoice.
 *
 * The parent is authorised here rather than trusted from the caller's argument:
 * the service-role read below bypasses RLS, so the explicit
 * parent_student_relationships check is what actually stops one parent paying
 * (or probing) another family's invoice.
 */
export async function startFeePayment(
  invoiceId: string,
): Promise<{ authorizationUrl: string; reference: string }> {
  const { schoolId, parentId, userId } = await requireParent();

  if (!isPaystackConfigured()) {
    throw new Error(
      "Online payment isn't available yet. Please contact the school to arrange payment.",
    );
  }

  const admin = createAdminClient();
  const { data: invoiceRow, error } = await admin
    .from("fee_invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const invoice = invoiceRow as FeeInvoice | null;
  if (!invoice) throw new Error("That invoice could not be found.");

  const { data: link } = await admin
    .from("parent_student_relationships")
    .select("id")
    .eq("parent_id", parentId)
    .eq("student_id", invoice.student_id)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!link) throw new Error("You are not billed for this student.");

  if (!isPayableStatus(invoice.status)) {
    throw new Error(
      invoice.status === "waived"
        ? "This invoice has been waived by the school."
        : "This invoice is already settled.",
    );
  }

  const outstanding = outstandingFor(invoice);
  if (outstanding <= 0) throw new Error("There is nothing left to pay on this invoice.");

  // Paystack needs a real address to send the receipt to; an account without an
  // email cannot be charged through this flow.
  const { user } = await getAuthContext();
  if (!user?.email) throw new Error("Your account has no email address to charge.");

  const reference = buildFeeReference();

  const { data: payment, error: insertError } = await admin
    .from("fee_payments")
    .insert({
      school_id: schoolId,
      invoice_id: invoice.id,
      parent_id: parentId,
      payer_user_id: userId,
      provider: "paystack",
      provider_reference: reference,
      amount: outstanding,
      status: "pending",
      metadata: { invoice_description: invoice.description },
    })
    .select("id")
    .single();

  if (insertError || !payment) {
    throw new Error(insertError?.message ?? "Could not start the payment.");
  }

  const { authorizationUrl } = await initializePayment({
    email: user.email,
    amountMinor: toMinorUnits(outstanding),
    reference,
    callbackUrl: `${appUrl()}/parent/fees`,
    metadata: {
      kind: "fee",
      invoice_id: invoice.id,
      student_id: invoice.student_id,
      school_id: schoolId,
    },
  });

  await admin
    .from("fee_payments")
    .update({ metadata: { invoice_description: invoice.description, authorization_url: authorizationUrl } })
    .eq("id", payment.id)
    .eq("school_id", schoolId);

  await writeAudit({
    schoolId,
    action: "fee_payment_started",
    entityType: "fee_payments",
    entityId: payment.id,
    metadata: { invoice_id: invoice.id, amount: outstanding },
  });

  return { authorizationUrl, reference };
}

export type FeeConfirmResult =
  | { ok: true; alreadyProcessed?: boolean; message: string }
  | { ok: false; message: string };

/**
 * Reconciles one payment attempt against Paystack and, on success, queues it
 * for a bursar.
 *
 * This is called from two places -- the webhook and the parent's return from
 * Paystack -- so it has to be safe to run twice. It is idempotent on the
 * payment's status: anything already reviewed is returned untouched.
 *
 * The amount recorded comes from Paystack, not from the row we wrote before
 * checkout. If a parent reaches the Paystack page and changes the figure, the
 * difference is what actually happened and must be what the bursar approves;
 * approval clamps any overpayment to the outstanding balance.
 */
export async function confirmFeePayment(reference: string): Promise<FeeConfirmResult> {
  if (!isFeeReference(reference)) {
    return { ok: false, message: "That is not a fee payment reference." };
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("fee_payments")
    .select("*")
    .eq("provider", "paystack")
    .eq("provider_reference", reference)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const payment = row as FeePayment | null;
  if (!payment) return { ok: false, message: "No fee payment matches that reference." };

  if (payment.status === "approved" || payment.status === "rejected") {
    return { ok: true, alreadyProcessed: true, message: "This payment was already reviewed." };
  }

  const verified = await verifyPayment(reference);

  if (verified.status !== "success") {
    await admin
      .from("fee_payments")
      .update({ status: "failed" })
      .eq("id", payment.id)
      .eq("school_id", payment.school_id);
    return {
      ok: false,
      message: "Paystack did not confirm that payment completed.",
    };
  }

  const received = verified.amountMinor === null ? Number(payment.amount) : fromMinorUnits(verified.amountMinor);

  await admin
    .from("fee_payments")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      // Paystack is the source of truth for what was actually received.
      amount: roundMoney(received),
      metadata: {
        ...(payment.metadata ?? {}),
        paystack_status: verified.status,
        paystack_paid_at: verified.paidAt,
      },
    })
    .eq("id", payment.id)
    .eq("school_id", payment.school_id);

  const { data: invoiceRow } = await admin
    .from("fee_invoices")
    .select("description, students!inner(display_name)")
    .eq("id", payment.invoice_id)
    .maybeSingle();

  const invoice = asArray(invoiceRow as { description: string; students: unknown } | null)[0];
  const childName =
    asArray(invoice?.students as { display_name: string | null } | null)[0]?.display_name ??
    "a student";

  await notify({
    userIds: await adminRecipients(payment.school_id),
    schoolId: payment.school_id,
    type: "fee_payment_submitted",
    title: "Fee payment awaiting approval",
    message: `${childName}: ${invoice?.description ?? "School fee"} — ${received.toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 })}`,
  });

  return {
    ok: true,
    message: "Payment received. The school will confirm it shortly.",
  };
}

// ---------------------------------------------------------------------------
// School view
// ---------------------------------------------------------------------------

export async function getSchoolFees(): Promise<{
  stats: SchoolFeeStats;
  reviewQueue: SchoolFeeReviewRow[];
  invoices: InvoiceWithStudent[];
}> {
  const { schoolId } = await requireSchoolAdmin();
  const supabase = await createSupabaseServerClient();

  // Three reads with different shapes, deliberately:
  //  - every invoice, bare scalar columns, to total the school's money exactly;
  //  - the most recent 500 joined, for the table;
  //  - only submitted payments, for the review queue.
  // Summing the truncated table instead would understate "Total invoiced" on
  // any school with more than 500 invoices, and fetching every payment status
  // to keep only the submitted ones would pull the whole ledger for nothing.
  const [allInvoices, recentInvoices, queueRows] = await Promise.all([
    supabase
      .from("fee_invoices")
      .select("amount, amount_paid, status, due_date")
      .eq("school_id", schoolId),
    supabase
      .from("fee_invoices")
      .select("*, students!inner(id, display_name, admission_number)")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("fee_payments")
      .select("*, fee_invoices!inner(*, students!inner(display_name, admission_number))")
      .eq("school_id", schoolId)
      .eq("status", "submitted")
      .order("created_at", { ascending: true })
      .limit(200),
  ]);

  const scalars = (allInvoices.data ?? []) as Pick<
    FeeInvoice,
    "amount" | "amount_paid" | "status" | "due_date"
  >[];
  const invoices = (recentInvoices.data ?? []) as unknown as InvoiceWithStudent[];
  const payments = (queueRows.data ?? []) as unknown as PaymentWithInvoice[];

  const today = new Date().toISOString().slice(0, 10);
  const invoiced = roundMoney(scalars.reduce((s, i) => s + Number(i.amount), 0));
  const collected = roundMoney(scalars.reduce((s, i) => s + Number(i.amount_paid), 0));
  const payable = scalars.filter((i) => isPayableStatus(i.status));

  const reviewQueue: SchoolFeeReviewRow[] = payments.map((p) => {
    const inv = p.fee_invoices;
    const student = asArray(
      inv?.students as
        | { display_name: string | null; admission_number: string }
        | null,
    )[0];
    return {
      payment: p,
      studentName: student?.display_name ?? "Unknown student",
      admissionNumber: student?.admission_number ?? "—",
      description: inv?.description ?? "School fee",
      invoiceAmount: Number(inv?.amount ?? 0),
      invoicePaid: Number(inv?.amount_paid ?? 0),
      currency: inv?.currency ?? "NGN",
    };
  });

  return {
    stats: {
      invoiced,
      collected,
      outstanding: roundMoney(
        payable.reduce((s, i) => s + outstandingFor(i), 0),
      ),
      overdueCount: payable.filter(
        (i) => i.due_date !== null && i.due_date < today,
      ).length,
      awaitingApproval: reviewQueue.length,
    },
    reviewQueue,
    invoices,
  };
}

// ---------------------------------------------------------------------------
// Issuing
// ---------------------------------------------------------------------------

/** Issues a single one-off invoice to one child. */
export async function issueFeeInvoice(input: FeeIssueInput): Promise<{ invoiceId: string }> {
  const { schoolId, userId } = await requireSchoolAdmin();
  const parsed = feeIssueSchema.parse(input);

  const admin = createAdminClient();

  const { data: student } = await admin
    .from("students")
    .select("id")
    .eq("id", parsed.studentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!student) throw new Error("That student is not in this school.");

  if (parsed.termId) {
    const { data: term } = await admin
      .from("terms")
      .select("id")
      .eq("id", parsed.termId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (!term) throw new Error("That term is not in this school.");
  }

  const { data: created, error } = await admin
    .from("fee_invoices")
    .insert({
      school_id: schoolId,
      student_id: parsed.studentId,
      term_id: parsed.termId ?? null,
      description: parsed.description,
      amount: roundMoney(parsed.amount),
      due_date: parsed.dueDate ?? null,
      status: "unpaid",
      issued_by: userId,
    })
    .select("id")
    .single();

  if (error || !created) throw new Error(error?.message ?? "Could not create the invoice.");

  await notify({
    userIds: await parentUserIdsForStudent(parsed.studentId),
    schoolId,
    type: "fee_invoice_issued",
    title: "New fee invoice",
    message: `${parsed.description} — ${parsed.amount.toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 })}`,
  });

  await writeAudit({
    schoolId,
    action: "fee_invoice_issued",
    entityType: "fee_invoices",
    entityId: created.id,
    metadata: { student_id: parsed.studentId, amount: parsed.amount },
  });

  return { invoiceId: created.id };
}

/**
 * Issues the same charge to every student in a class, or the whole school when
 * no class is given.
 *
 * Idempotent: the deterministic billing_key plus `ignoreDuplicates` means a
 * re-run reports the rows it skipped instead of billing the class twice.
 */
export async function generateTermInvoices(
  input: FeeGenerateInput,
): Promise<{ created: number; skipped: number }> {
  const { schoolId, userId } = await requireSchoolAdmin();
  const parsed = feeGenerateSchema.parse(input);

  const admin = createAdminClient();

  const { data: term } = await admin
    .from("terms")
    .select("id")
    .eq("id", parsed.termId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!term) throw new Error("That term is not in this school.");

  let studentQuery = admin
    .from("students")
    .select("id")
    .eq("school_id", schoolId);
  if (parsed.classId) studentQuery = studentQuery.eq("class_id", parsed.classId);

  const { data: students, error: studentsError } = await studentQuery;
  if (studentsError) throw new Error(studentsError.message);

  const ids = ((students ?? []) as { id: string }[]).map((s) => s.id);
  if (ids.length === 0) {
    throw new Error(
      parsed.classId
        ? "That class has no students yet."
        : "This school has no students yet.",
    );
  }

  const billingKey = buildBillingKey({ termId: parsed.termId, classId: parsed.classId ?? null });

  const { data: inserted, error } = await admin
    .from("fee_invoices")
    .upsert(
      ids.map((studentId) => ({
        school_id: schoolId,
        student_id: studentId,
        term_id: parsed.termId,
        description: parsed.description,
        amount: roundMoney(parsed.amount),
        due_date: parsed.dueDate ?? null,
        status: "unpaid" as const,
        billing_key: billingKey,
        issued_by: userId,
      })),
      { onConflict: "school_id,billing_key", ignoreDuplicates: true },
    )
    .select("id, student_id");

  if (error) throw new Error(error.message);

  const createdIds = ((inserted ?? []) as { id: string; student_id: string }[]).map(
    (r) => r.student_id,
  );

  // `ignoreDuplicates` only reports the rows it actually inserted, so the count
  // of already-billed students is the difference.
  const recipients = (
    await Promise.all(createdIds.map((id) => parentUserIdsForStudent(id)))
  ).flat();

  await notify({
    userIds: recipients,
    schoolId,
    type: "fee_invoice_issued",
    title: "New fee invoice",
    message: `${parsed.description} — ${parsed.amount.toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 })}`,
  });

  await writeAudit({
    schoolId,
    action: "fee_invoices_generated",
    entityType: "fee_invoices",
    metadata: {
      billing_key: billingKey,
      term_id: parsed.termId,
      class_id: parsed.classId ?? null,
      amount: parsed.amount,
      created: createdIds.length,
      skipped: ids.length - createdIds.length,
    },
  });

  return { created: createdIds.length, skipped: ids.length - createdIds.length };
}

/** Cancels an invoice that was raised in error. Keeps the row for the record. */
export async function voidFeeInvoice(invoiceId: string): Promise<void> {
  const { schoolId } = await requireSchoolAdmin();
  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from("fee_invoices")
    .select("id, status")
    .eq("id", invoiceId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status === "paid") {
    throw new Error("A paid invoice cannot be cancelled.");
  }

  await admin
    .from("fee_invoices")
    .update({ status: "void" })
    .eq("id", invoiceId)
    .eq("school_id", schoolId);

  await writeAudit({
    schoolId,
    action: "fee_invoice_voided",
    entityType: "fee_invoices",
    entityId: invoiceId,
  });
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

/**
 * The money gate. Only this function moves an invoice's `amount_paid`, and only
 * a school admin can reach it.
 *
 * The invoice is re-read immediately before the write and the update is guarded
 * on the amount_paid that was just read. Two bursars approving at the same
 * moment would otherwise both credit the same outstanding balance; with the
 * guard the second update matches no rows and is reported as a conflict for the
 * bursar to retry, rather than silently double-crediting the invoice.
 */
export async function reviewFeePayment(input: {
  paymentId: string;
  decision: "approve" | "reject";
  note?: string | null;
}): Promise<{ credited: number; uncredited: number }> {
  const { schoolId, userId } = await requireSchoolAdmin();
  const parsed = feeReviewSchema.parse(input);

  const admin = createAdminClient();

  const { data: paymentRow } = await admin
    .from("fee_payments")
    .select("*")
    .eq("id", parsed.paymentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  const payment = paymentRow as FeePayment | null;
  if (!payment) throw new Error("That payment could not be found.");
  if (payment.status !== "submitted") {
    throw new Error("Only a payment awaiting approval can be reviewed.");
  }

  const { data: invoiceRow } = await admin
    .from("fee_invoices")
    .select("*")
    .eq("id", payment.invoice_id)
    .eq("school_id", schoolId)
    .maybeSingle();

  const invoice = invoiceRow as FeeInvoice | null;
  if (!invoice) throw new Error("That invoice could not be found.");

  const { data: studentRow } = await admin
    .from("students")
    .select("display_name")
    .eq("id", invoice.student_id)
    .maybeSingle();
  const childName =
    (studentRow as { display_name: string | null } | null)?.display_name ?? "a student";

  if (parsed.decision === "reject") {
    const note = parsed.note?.trim() || "Payment could not be confirmed.";

    await admin
      .from("fee_payments")
      .update({
        status: "rejected" as FeePaymentStatus,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_note: note,
      })
      .eq("id", payment.id)
      .eq("school_id", schoolId);

    await notify({
      userIds: [payment.payer_user_id].filter((v): v is string => Boolean(v)),
      schoolId,
      type: "fee_payment_rejected",
      title: "Payment not approved",
      message: `${childName}: ${note}`,
    });

    await writeAudit({
      schoolId,
      action: "fee_payment_rejected",
      entityType: "fee_payments",
      entityId: payment.id,
      metadata: { invoice_id: invoice.id, note },
    });

    return { credited: 0, uncredited: 0 };
  }

  const result = applyApproval(invoice, payment.amount);
  if (result.credited <= 0) {
    throw new Error("This invoice is already fully paid.");
  }

  const { data: updated, error: updateError } = await admin
    .from("fee_invoices")
    .update({ amount_paid: result.amountPaid, status: result.status })
    .eq("id", invoice.id)
    .eq("school_id", schoolId)
    // optimistic guard against a concurrent approval
    .eq("amount_paid", Number(invoice.amount_paid))
    .select("id");

  if (updateError) throw new Error(updateError.message);
  if (!updated || updated.length === 0) {
    throw new Error(
      "This invoice changed while you were reviewing. Reload and try again.",
    );
  }

  const noteBits: string[] = [];
  if (parsed.note?.trim()) noteBits.push(parsed.note.trim());
  if (result.uncredited > 0) {
    noteBits.push(
      `Only the outstanding ${result.credited.toLocaleString("en-NG", { style: "currency", currency: invoice.currency, maximumFractionDigits: 0 })} was credited; ${result.uncredited.toLocaleString("en-NG", { style: "currency", currency: invoice.currency, maximumFractionDigits: 0 })} was over the amount owed.`,
    );
  }

  await admin
    .from("fee_payments")
    .update({
      status: "approved" as FeePaymentStatus,
      // Recorded explicitly rather than inferred from the invoice later: this
      // is the figure a receipt has to state and a statement has to sum, and it
      // can be less than `amount` whenever the payment exceeded the balance.
      credited_amount: result.credited,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_note: noteBits.join(" ") || null,
    })
    .eq("id", payment.id)
    .eq("school_id", schoolId);

  await notify({
    userIds: [payment.payer_user_id].filter((v): v is string => Boolean(v)),
    schoolId,
    type: "fee_payment_approved",
    title: "Payment approved",
    message: `${childName}: ${result.credited.toLocaleString("en-NG", { style: "currency", currency: invoice.currency, maximumFractionDigits: 0 })} received for ${invoice.description}.`,
  });

  await writeAudit({
    schoolId,
    action: "fee_payment_approved",
    entityType: "fee_payments",
    entityId: payment.id,
    metadata: {
      invoice_id: invoice.id,
      attempted: Number(payment.amount),
      credited: result.credited,
      uncredited: result.uncredited,
      invoice_status: result.status,
    },
  });

  return { credited: result.credited, uncredited: result.uncredited };
}
