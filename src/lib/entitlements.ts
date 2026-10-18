import type { SubscriptionPlan, SubscriptionStatus } from "@/types/database";

/**
 * The switches a subscription plan can carry.
 *
 * Every key here is enforced somewhere in the server code, so a plan that turns
 * one off really does stop the feature rather than hiding a button. A key that
 * is absent from a plan's flags means "included": plans seeded before switches
 * existed, and any plan an admin has not edited, keep working exactly as they
 * did.
 */
export const PLAN_FEATURES = [
  {
    key: "courses_lessons",
    label: "Courses & lessons",
    description: "Course, module and lesson content for higher-education levels.",
  },
  {
    key: "assignments",
    label: "Assignments & grading",
    description: "Teachers create assignments and grade submissions.",
  },
  {
    key: "cbt",
    label: "CBT examinations",
    description: "Exam series, question banks and computer-based testing.",
  },
  {
    key: "analytics",
    label: "Analytics dashboards",
    description: "School and teacher performance analytics.",
  },
  {
    key: "parent_portal",
    label: "Parent portal",
    description: "Parent accounts linked to students.",
  },
  {
    key: "announcements",
    label: "Announcements",
    description: "School-wide and targeted announcements.",
  },
  {
    key: "live_sessions",
    label: "Live teaching",
    description: "Scheduled live classes with attendance.",
  },
  {
    key: "school_media",
    label: "School media",
    description: "Events and gallery for the school's public presence.",
  },
] as const;

export type PlanFeatureKey = (typeof PLAN_FEATURES)[number]["key"];

export const PLAN_FEATURE_KEYS: readonly PlanFeatureKey[] = PLAN_FEATURES.map(
  (feature) => feature.key,
);

export function planFeatureLabel(key: PlanFeatureKey): string {
  return PLAN_FEATURES.find((feature) => feature.key === key)?.label ?? key;
}

export type PlanTerms = {
  planId: string | null;
  planName: string | null;
  /** null means unlimited. */
  studentLimit: number | null;
  /** null means unlimited. */
  teacherLimit: number | null;
  /** Marketing bullets shown on the pricing cards. Not enforced. */
  features: string[];
  flags: Partial<Record<PlanFeatureKey, boolean>>;
};

export type EntitlementState = "active" | "grace" | "expired";

export type Entitlement = {
  state: EntitlementState;
  terms: PlanTerms;
  status: SubscriptionStatus | null;
  currentPeriodEnd: string | null;
  /** When a school with no subscription must have chosen a plan by. */
  graceEndsAt: string | null;
  message: string;
};

export type SeatKind = "student" | "teacher";

export const DEFAULT_GRACE_DAYS = 30;

const EMPTY_TERMS: PlanTerms = {
  planId: null,
  planName: null,
  studentLimit: null,
  teacherLimit: null,
  features: [],
  flags: {},
};

export function normaliseSeatLimit(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.trunc(parsed));
}

export function parseFeatureLimits(raw: unknown): {
  features: string[];
  flags: Partial<Record<PlanFeatureKey, boolean>>;
} {
  const limits =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const features = Array.isArray(limits.features)
    ? limits.features.filter((f): f is string => typeof f === "string")
    : [];

  const rawFlags =
    limits.flags && typeof limits.flags === "object" && !Array.isArray(limits.flags)
      ? (limits.flags as Record<string, unknown>)
      : {};

  const flags: Partial<Record<PlanFeatureKey, boolean>> = {};
  for (const key of PLAN_FEATURE_KEYS) {
    if (typeof rawFlags[key] === "boolean") flags[key] = rawFlags[key];
  }

  return { features, flags };
}

export function planTermsOf(plan: SubscriptionPlan | null | undefined): PlanTerms {
  if (!plan) return { ...EMPTY_TERMS, features: [], flags: {} };

  const { features, flags } = parseFeatureLimits(plan.feature_limits);
  return {
    planId: plan.id,
    planName: plan.name,
    studentLimit: normaliseSeatLimit(plan.student_limit),
    teacherLimit: normaliseSeatLimit(plan.teacher_limit),
    features,
    flags,
  };
}

export function isSubscriptionLive(
  input: { status: SubscriptionStatus | string | null; currentPeriodEnd: string | null },
  now: Date = new Date(),
): boolean {
  if (input.status !== "active" && input.status !== "trialing") return false;
  if (!input.currentPeriodEnd) return true;
  const endsAt = new Date(input.currentPeriodEnd).getTime();
  if (Number.isNaN(endsAt)) return true;
  return endsAt > now.getTime();
}

export function graceDeadline(
  schoolCreatedAt: string | null | undefined,
  graceDays: number = DEFAULT_GRACE_DAYS,
): Date | null {
  if (!schoolCreatedAt) return null;
  const createdAt = new Date(schoolCreatedAt).getTime();
  if (Number.isNaN(createdAt)) return null;
  const days = Number.isFinite(graceDays) && graceDays >= 0 ? graceDays : DEFAULT_GRACE_DAYS;
  return new Date(createdAt + days * 24 * 60 * 60 * 1000);
}

export type EntitlementInput = {
  plan?: SubscriptionPlan | null;
  subscription?: {
    plan_id?: string | null;
    status: SubscriptionStatus | string;
    current_period_end: string | null;
  } | null;
  schoolCreatedAt?: string | null;
  graceDays?: number;
  now?: Date;
};

/**
 * Resolves which terms a school is on.
 *
 * A school is "subscribed" only when it has a subscription row pointing at a
 * plan we could load. Anything else is a school that has never chosen a plan,
 * and it gets `graceDays` from the day the school was created before it is
 * treated as expired.
 */
export function evaluateEntitlement(input: EntitlementInput = {}): Entitlement {
  const now = input.now ?? new Date();
  const subscription = input.subscription ?? null;
  const plan = input.plan ?? null;
  const subscribed = subscription != null && subscription.plan_id != null && plan != null;

  if (subscribed) {
    const terms = planTermsOf(plan);
    const live = isSubscriptionLive(
      { status: subscription!.status, currentPeriodEnd: subscription!.current_period_end },
      now,
    );
    if (live) {
      const until = subscription!.current_period_end;
      return {
        state: "active",
        terms,
        status: subscription!.status as SubscriptionStatus,
        currentPeriodEnd: until,
        graceEndsAt: null,
        message: until
          ? `${terms.planName} plan active until ${formatDate(until)}.`
          : `${terms.planName} plan active.`,
      };
    }
    return {
      state: "expired",
      terms,
      status: subscription!.status as SubscriptionStatus,
      currentPeriodEnd: subscription!.current_period_end,
      graceEndsAt: null,
      message: "Your subscription has ended. Renew to add students and teachers again.",
    };
  }

  const deadline = graceDeadline(input.schoolCreatedAt, input.graceDays);
  const inGrace = deadline === null || deadline.getTime() > now.getTime();

  if (inGrace) {
    const daysLeft =
      deadline === null
        ? null
        : Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    return {
      state: "grace",
      terms: { ...EMPTY_TERMS },
      status: null,
      currentPeriodEnd: null,
      graceEndsAt: deadline ? deadline.toISOString() : null,
      message:
        daysLeft === null
          ? "No plan chosen yet. Choose a plan to set your school's limits."
          : daysLeft === 0
            ? "No plan chosen yet — choose a plan today to keep adding students."
            : `No plan chosen yet. You can add students and teachers for ${daysLeft} more ${daysLeft === 1 ? "day" : "days"}.`,
    };
  }

  return {
    state: "expired",
    terms: { ...EMPTY_TERMS },
    status: null,
    currentPeriodEnd: null,
    graceEndsAt: deadline ? deadline.toISOString() : null,
    message: "No plan chosen yet and the free setup period has ended. Choose a plan to continue adding students and teachers.",
  };
}

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "the end of your billing period";
  return parsed.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export type SeatDecision = {
  allowed: boolean;
  kind: SeatKind;
  limit: number | null;
  used: number;
  adding: number;
  remaining: number | null;
  message: string;
};

/**
 * Whether `adding` more people fit under the school's terms.
 *
 * An expired school is a school at limit zero: nothing is deleted and every
 * record already on the platform stays readable, but no new seat is issued
 * until the subscription is renewed.
 */
export function evaluateSeat(input: {
  entitlement: Entitlement;
  kind: SeatKind;
  used: number;
  adding: number;
}): SeatDecision {
  const { entitlement, kind } = input;
  const used = Math.max(0, Math.trunc(Number(input.used) || 0));
  const adding = Math.max(0, Math.trunc(Number(input.adding) || 0));

  const planLimit = kind === "student" ? entitlement.terms.studentLimit : entitlement.terms.teacherLimit;
  const limit = entitlement.state === "expired" ? 0 : planLimit;
  const remaining = limit === null ? null : Math.max(0, limit - used);
  const allowed = adding === 0 || limit === null || used + adding <= limit;

  const noun = kind === "student" ? "students" : "teachers";
  const planName = entitlement.terms.planName;

  let message = "";
  if (!allowed) {
    if (entitlement.state === "expired") {
      message = entitlement.message;
    } else if (remaining !== null && remaining < adding) {
      message = `Your ${planName ?? "current"} plan allows up to ${limit} ${noun} and this school already has ${used}. Remove ${adding - remaining} ${noun} or upgrade your plan to add ${adding} more.`;
    } else {
      message = `Your ${planName ?? "current"} plan allows up to ${limit} ${noun} and this school already has ${used}.`;
    }
  }

  return { allowed, kind, limit, used, adding, remaining, message };
}

/**
 * Whether the school's plan includes a feature.
 *
 * A flag that is missing rather than `false` means included, so a plan written
 * before switches existed keeps every feature. Only an explicit `false` takes
 * something away.
 */
export function hasFeature(
  entitlement: Pick<Entitlement, "terms">,
  key: PlanFeatureKey,
): boolean {
  return entitlement.terms.flags[key] !== false;
}

export function featureBlockedMessage(key: PlanFeatureKey): string {
  return `Your school's plan doesn't include ${planFeatureLabel(key)}. Upgrade your plan to use it.`;
}
