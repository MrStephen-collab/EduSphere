import { randomUUID } from "node:crypto";
import { z } from "zod";
import type {
  BillingInterval,
  Payment,
  PaymentStatus,
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@/types/database";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { requireSchoolAdmin } from "@/services/shared";
import { getAuthContext } from "@/lib/auth/auth-context";
import { sendSubscriptionConfirmedEmail } from "@/email/hooks";
import {
  initializePayment,
  isPaystackConfigured,
  refundPayment as paystackRefund,
  verifyPayment,
} from "@/lib/paystack";

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

export type Plan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billingInterval: BillingInterval;
  studentLimit: number | null;
  teacherLimit: number | null;
  features: string[];
  status: string;
};

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function featureList(row: Pick<SubscriptionPlan, "feature_limits">): string[] {
  const limits = row.feature_limits;
  const features = Array.isArray(limits?.features)
    ? (limits.features as string[])
    : [];
  return features.filter((f): f is string => typeof f === "string");
}

function toPlan(row: SubscriptionPlan): Plan {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    billingInterval: row.billing_interval,
    studentLimit: row.student_limit == null ? null : Number(row.student_limit),
    teacherLimit: row.teacher_limit == null ? null : Number(row.teacher_limit),
    features: featureList(row),
    status: row.status,
  };
}

export const planSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  price: z.coerce.number().min(0, "Price can't be negative.").max(100_000_000),
  billingInterval: z.enum(["monthly", "annual"]),
  studentLimit: z.coerce
    .number()
    .int("Student limit must be a whole number.")
    .min(0)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  teacherLimit: z.coerce
    .number()
    .int("Teacher limit must be a whole number.")
    .min(0)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  features: z
    .array(z.string().trim().min(1))
    .max(30)
    .optional()
    .default([])
    .transform((v) => v.filter((f) => f) as string[]),
});

export type PlanInput = z.infer<typeof planSchema>;

// ---------------------------------------------------------------------------
// Public + school billing reads
// ---------------------------------------------------------------------------

const PLANS_CACHE_TTL_MS = 5 * 60 * 1000;

let plansCache: { data: Plan[]; at: number } | null = null;

export async function getPublicPlans(): Promise<Plan[]> {
  const now = Date.now();
  if (plansCache && now - plansCache.at < PLANS_CACHE_TTL_MS) {
    return plansCache.data;
  }

  const supabase = createPublicClient();
  const { data } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  const plans = ((data ?? []) as SubscriptionPlan[]).map(toPlan);
  plansCache = { data: plans, at: now };
  return plans;
}

export function subscriptionPeriodLabel(
  sub: { current_period_start: string | null; current_period_end: string | null },
): string {
  const fmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  if (!sub.current_period_start) return "No period set";
  if (!sub.current_period_end) return "Active since " + new Date(sub.current_period_start).toLocaleDateString(undefined, fmt);
  return (
    new Date(sub.current_period_start).toLocaleDateString(undefined, fmt) +
    " – " +
    new Date(sub.current_period_end).toLocaleDateString(undefined, fmt)
  );
}

export function subscriptionDisplayStatus(
  sub: { status: SubscriptionStatus; current_period_end: string | null },
): { label: string; tone: "ok" | "warn" | "muted" } {
  const expired =
    sub.status === "active" &&
    sub.current_period_end != null &&
    new Date(sub.current_period_end) < new Date();
  if (expired) return { label: "Expired", tone: "warn" };
  switch (sub.status) {
    case "active":
      return { label: "Active", tone: "ok" };
    case "trialing":
      return { label: "Trial", tone: "ok" };
    case "past_due":
      return { label: "Overdue", tone: "warn" };
    case "canceled":
      return { label: "Canceled", tone: "muted" };
    default:
      return { label: "Inactive", tone: "muted" };
  }
}

export type SchoolSubscriptionView = {
  id: string;
  status: SubscriptionStatus;
  plan: Plan | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  periodLabel: string;
  statusLabel: string;
  statusTone: "ok" | "warn" | "muted";
};

export type SchoolPaymentView = {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
};

type SubscriptionRow = Subscription & {
  plans: SubscriptionPlan | null;
};

export async function getSchoolBilling(schoolId: string): Promise<{
  subscription: SchoolSubscriptionView | null;
  payments: SchoolPaymentView[];
}> {
  const supabase = await createSupabaseServerClient();

  const [{ data: subData }, { data: paymentData }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("*, plans(*)")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("payments")
      .select("*")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const sub = (subData ?? null) as SubscriptionRow | null;
  const subscription: SchoolSubscriptionView | null = sub
    ? {
        id: sub.id,
        status: sub.status,
        plan: sub.plans ? toPlan(sub.plans) : null,
        currentPeriodStart: sub.current_period_start,
        currentPeriodEnd: sub.current_period_end,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        periodLabel: subscriptionPeriodLabel(sub),
        statusLabel: subscriptionDisplayStatus(sub).label,
        statusTone: subscriptionDisplayStatus(sub).tone,
      }
    : null;

  const payments = ((paymentData ?? []) as Payment[]).map((p) => {
    const meta = (p.metadata ?? {}) as { plan_name?: unknown } | null;
    return {
      id: p.id,
      date: p.created_at ?? new Date().toISOString(),
      description: typeof meta?.plan_name === "string" ? meta.plan_name : p.provider ?? "Subscription",
      amount: Number(p.amount ?? 0),
      currency: p.currency ?? "NGN",
      status: (p.status as PaymentStatus) ?? "pending",
    };
  });

  return { subscription, payments };
}

// ---------------------------------------------------------------------------
// Checkout (school)
// ---------------------------------------------------------------------------

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function addPeriod(iso: string, interval: BillingInterval): string {
  const d = new Date(iso);
  if (interval === "annual") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

async function writeAudit(opts: {
  schoolId: string | null;
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

export async function startCheckout(
  planId: string,
): Promise<{ authorizationUrl: string }> {
  const req = await requireSchoolAdmin();
  const schoolId = req.schoolId;
  const user = req.context.user;
  if (!user) throw new Error("You need to be signed in.");

  if (!isPaystackConfigured()) {
    throw new Error(
      "Paystack isn't configured for this deployment yet. Add PAYSTACK_SECRET_KEY to start taking payments.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: planData } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("id", planId)
    .eq("status", "active")
    .maybeSingle();
  if (!planData) throw new Error("That plan isn't available.");

  const plan = toPlan(planData);
  const reference = `ed_${randomUUID().replace(/-/g, "")}`;
  const admin = createAdminClient();

  const { data: payment } = await admin
    .from("payments")
    .insert({
      school_id: schoolId,
      provider: "paystack",
      provider_reference: reference,
      amount: plan.price,
      currency: "NGN",
      status: "pending",
      metadata: {
        school_id: schoolId,
        plan_id: plan.id,
        plan_name: plan.name,
        billing_interval: plan.billingInterval,
      },
    })
    .select("id")
    .single();
  if (!payment) throw new Error("We couldn't start your checkout.");

  const { authorizationUrl } = await initializePayment({
    email: user.email ?? `school-${schoolId}@edusphere.local`,
    amountMinor: Math.round(plan.price * 100),
    reference,
    callbackUrl: `${appUrl()}/school/billing`,
    metadata: {
      school_id: schoolId,
      plan_id: plan.id,
      plan_name: plan.name,
      billing_interval: plan.billingInterval,
    },
  });

  await admin
    .from("payments")
    .update({ metadata: { authorization_url: authorizationUrl } })
    .eq("id", payment.id)
    .eq("school_id", schoolId);

  return { authorizationUrl };
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export type VerifyOutcome =
  | { ok: true; planName: string; alreadyProcessed?: boolean }
  | { ok: false; message: string };

export async function confirmPaystackPayment(
  reference: string,
): Promise<VerifyOutcome | null> {
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("*")
    .eq("provider", "paystack")
    .eq("provider_reference", reference)
    .maybeSingle();
  if (!payment) return null;

  const meta = (payment.metadata ?? {}) as {
    plan_id?: unknown;
    plan_name?: unknown;
    billing_interval?: unknown;
  };

  if (payment.status === "paid") {
    return {
      ok: true,
      planName: typeof meta.plan_name === "string" ? meta.plan_name : "Plan",
      alreadyProcessed: true,
    };
  }

  const verified = await verifyPayment(reference);
  if (verified.status !== "success") {
    const failed = verified.status === "failed" ? "failed" : "canceled";
    await admin
      .from("payments")
      .update({ status: failed })
      .eq("id", payment.id)
      .eq("school_id", payment.school_id);
    return {
      ok: false,
      message: verified.status === "failed" ? "Payment failed." : "Payment wasn't completed.",
    };
  }

  const nowIso = new Date().toISOString();
  await admin
    .from("payments")
    .update({
      status: "paid",
      paid_at: verified.paidAt ?? nowIso,
    })
    .eq("id", payment.id)
    .eq("school_id", payment.school_id);

  const planId =
    typeof meta.plan_id === "string" ? meta.plan_id : payment.subscription_id ?? null;
  const interval: BillingInterval =
    meta.billing_interval === "annual" ? "annual" : "monthly";
  const periodEnd = addPeriod(nowIso, interval);

  const { data: existingSub } = await admin
    .from("subscriptions")
    .select("id")
    .eq("school_id", payment.school_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let subscriptionId = existingSub?.id ?? null;
  if (subscriptionId) {
    await admin
      .from("subscriptions")
      .update({
        plan_id: planId,
        status: "active",
        current_period_start: nowIso,
        current_period_end: periodEnd,
        cancel_at_period_end: false,
      })
      .eq("id", subscriptionId)
      .eq("school_id", payment.school_id);
  } else {
    const { data: inserted } = await admin
      .from("subscriptions")
      .insert({
        school_id: payment.school_id,
        plan_id: planId,
        status: "active",
        current_period_start: nowIso,
        current_period_end: periodEnd,
      })
      .select("id")
      .single();
    subscriptionId = inserted?.id ?? null;
  }

  if (subscriptionId) {
    await admin
      .from("payments")
      .update({ subscription_id: subscriptionId })
      .eq("id", payment.id)
      .eq("school_id", payment.school_id);
  }

  await writeAudit({
    schoolId: payment.school_id,
    action: "subscription_changed",
    entityType: "subscriptions",
    entityId: subscriptionId ?? undefined,
    metadata: {
      plan_id: planId,
      plan_name: typeof meta.plan_name === "string" ? meta.plan_name : null,
      provider_reference: reference,
      amount: Number(payment.amount),
    },
  });

  await sendSubscriptionConfirmedEmail({
    schoolId: payment.school_id,
    planName: typeof meta.plan_name === "string" ? meta.plan_name : "Plan",
    amountMinor: Number(payment.amount) || 0,
    interval,
    periodEnd,
  });

  return {
    ok: true,
    planName: typeof meta.plan_name === "string" ? meta.plan_name : "Plan",
  };
}

export async function confirmSchoolPayment(
  schoolId: string,
  reference: string,
): Promise<VerifyOutcome | null> {
  const supabase = await createSupabaseServerClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("provider_reference")
    .eq("school_id", schoolId)
    .eq("provider", "paystack")
    .eq("provider_reference", reference)
    .maybeSingle();
  if (!payment) return null;
  return confirmPaystackPayment(reference);
}

// ---------------------------------------------------------------------------
// Platform: overview + plan management
// ---------------------------------------------------------------------------

export async function requirePlatformAdmin() {
  const context = await getAuthContext();
  if (!context.user || !context.roles.includes("SUPER_ADMIN")) {
    throw new Error("Only platform administrators can manage subscriptions.");
  }
  return context.user;
}

export async function getBillingOverview() {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const [
    activeRes,
    totalRes,
    paidRes,
    pendingRes,
    subsRes,
    paymentsRes,
    plansRes,
  ] = await Promise.all([
    admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    admin.from("subscriptions").select("id", { count: "exact", head: true }),
    admin
      .from("payments")
      .select("amount, paid_at")
      .eq("status", "paid"),
    admin
      .from("payments")
      .select("amount")
      .in("status", ["pending"]),
    admin
      .from("subscriptions")
      .select("*, schools(name), plans(name, price, billing_interval)")
      .order("updated_at", { ascending: false })
      .limit(100),
    admin
      .from("payments")
      .select("*, schools(name)")
      .order("created_at", { ascending: false })
      .limit(25),
    admin.from("subscription_plans").select("*").order("created_at", { ascending: true }),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
  let monthlyRevenue = 0;
  let annualRevenue = 0;
  for (const p of (paidRes.data ?? []) as { amount: number; paid_at: string | null }[]) {
    const paidAt = p.paid_at;
    if (!paidAt) continue;
    const amount = Number(p.amount);
    if (paidAt >= monthStart) monthlyRevenue += amount;
    if (paidAt >= yearStart) annualRevenue += amount;
  }
  const pendingAmount = ((pendingRes.data ?? []) as { amount: number }[]).reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );

  return {
    activeSubscriptions: activeRes.count ?? 0,
    totalSubscriptions: totalRes.count ?? 0,
    monthlyRevenue,
    annualRevenue,
    pendingAmount,
    subscriptions: (subsRes.data ?? []).map((s) => {
      const school = (s as { schools?: { name?: string } | null }).schools;
      const plan = (s as { plans?: { name?: string; price?: number; billing_interval?: string } | null }).plans;
      const meta = { status: s.status as SubscriptionStatus, current_period_end: s.current_period_end as string | null };
      const status = subscriptionDisplayStatus(meta);
      return {
        id: s.id as string,
        schoolName: school?.name ?? "Unknown school",
        planName: plan?.name ?? "No plan",
        price: plan ? Number(plan.price) : 0,
        billingInterval: (plan?.billing_interval as BillingInterval | undefined) ?? "monthly",
        statusLabel: status.label,
        statusTone: status.tone,
        periodLabel: subscriptionPeriodLabel({
          current_period_start: s.current_period_start as string | null,
          current_period_end: s.current_period_end as string | null,
        }),
        cancelAtPeriodEnd: s.cancel_at_period_end as boolean,
      };
    }),
    payments: (paymentsRes.data ?? []).map((p) => {
      const school = (p as { schools?: { name?: string } | null }).schools;
      const meta = (p.metadata ?? {}) as { plan_name?: unknown } | null;
      return {
        id: p.id as string,
        schoolName: school?.name ?? "Unknown school",
        provider: p.provider as string,
        description: typeof meta?.plan_name === "string" ? meta.plan_name : "Subscription",
        amount: Number(p.amount),
        currency: (p.currency as string) ?? "NGN",
        status: p.status as PaymentStatus,
        paidAt: (p.paid_at as string | null) ?? (p.created_at as string),
      };
    }),
    plans: ((plansRes.data ?? []) as SubscriptionPlan[]).map(toPlan),
  };
}

export async function platformCreatePlan(input: PlanInput): Promise<string> {
  await requirePlatformAdmin();
  const parsed = planSchema.parse(input);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscription_plans")
    .insert({
      name: parsed.name,
      description: parsed.description,
      price: parsed.price,
      billing_interval: parsed.billingInterval,
      student_limit: parsed.studentLimit,
      teacher_limit: parsed.teacherLimit,
      feature_limits: { features: parsed.features },
      status: "active",
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("A plan with that name already exists.");
    throw new Error("We couldn't create the plan.");
  }
  await writeAudit({
    schoolId: null,
    action: "plan_created",
    entityType: "subscription_plans",
    entityId: data.id,
    metadata: { name: parsed.name, price: parsed.price },
  });
  return data.id;
}

export async function platformUpdatePlan(
  id: string,
  input: Partial<PlanInput>,
): Promise<void> {
  await requirePlatformAdmin();
  const parsed = planSchema.partial().parse(input);
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (parsed.name !== undefined) patch.name = parsed.name;
  if (parsed.description !== undefined) patch.description = parsed.description;
  if (parsed.price !== undefined) patch.price = parsed.price;
  if (parsed.billingInterval !== undefined) patch.billing_interval = parsed.billingInterval;
  if (parsed.studentLimit !== undefined) patch.student_limit = parsed.studentLimit;
  if (parsed.teacherLimit !== undefined) patch.teacher_limit = parsed.teacherLimit;
  if (parsed.features !== undefined) patch.feature_limits = { features: parsed.features };

  const { error } = await admin.from("subscription_plans").update(patch).eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("A plan with that name already exists.");
    throw new Error("We couldn't update the plan.");
  }
}

export async function platformSetPlanStatus(
  id: string,
  status: "active" | "inactive",
): Promise<void> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("subscription_plans")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error("We couldn't update the plan.");
}

export async function platformRefundPayment(paymentId: string): Promise<void> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) throw new Error("Payment not found.");
  if (payment.status !== "paid") throw new Error("Only paid payments can be refunded.");

  if (payment.provider === "paystack" && payment.provider_reference) {
    await paystackRefund(payment.provider_reference);
  }

  await admin.from("payments").update({ status: "refunded" }).eq("id", paymentId);
  await writeAudit({
    schoolId: payment.school_id,
    action: "payment_refunded",
    entityType: "payments",
    entityId: paymentId,
    metadata: { provider_reference: payment.provider_reference },
  });
}