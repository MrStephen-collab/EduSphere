import { describe, expect, it } from "vitest";
import {
  DEFAULT_GRACE_DAYS,
  PLAN_FEATURES,
  PLAN_FEATURE_KEYS,
  evaluateEntitlement,
  evaluateSeat,
  featureBlockedMessage,
  graceDeadline,
  hasFeature,
  isSubscriptionLive,
  normaliseSeatLimit,
  parseFeatureLimits,
  planFeatureLabel,
  planTermsOf,
} from "@/lib/entitlements";
import type { SubscriptionPlan } from "@/types/database";

function plan(overrides: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
  return {
    id: "plan-1",
    name: "Professional",
    description: null,
    price: 24000,
    billing_interval: "monthly",
    student_limit: 500,
    teacher_limit: 20,
    feature_limits: {},
    status: "active",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const now = new Date("2026-06-15T12:00:00.000Z");
const daysFromNow = (days: number) =>
  new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

describe("plan feature switches", () => {
  it("declares a label for every feature key", () => {
    for (const key of PLAN_FEATURE_KEYS) {
      expect(planFeatureLabel(key)).not.toBe(key);
      expect(PLAN_FEATURES.some((f) => f.key === key)).toBe(true);
    }
  });

  it("reads flags as booleans and ignores anything else", () => {
    const parsed = parseFeatureLimits({
      features: ["Up to 500 students", 42, null],
      flags: { analytics: false, cbt: true, parent_portal: "yes" },
    });
    expect(parsed.features).toEqual(["Up to 500 students"]);
    expect(parsed.flags).toEqual({ analytics: false, cbt: true });
  });

  it("survives a missing or malformed feature_limits value", () => {
    expect(parseFeatureLimits(null)).toEqual({ features: [], flags: {} });
    expect(parseFeatureLimits("features")).toEqual({ features: [], flags: {} });
    expect(parseFeatureLimits({ features: "nope", flags: [] })).toEqual({
      features: [],
      flags: {},
    });
  });

  it("treats an unlisted feature as included", () => {
    const terms = planTermsOf(plan());
    expect(hasFeature({ terms }, "analytics")).toBe(true);
    expect(hasFeature({ terms }, "cbt")).toBe(true);
  });

  it("excludes only what a plan explicitly turns off", () => {
    const terms = planTermsOf(
      plan({ feature_limits: { flags: { analytics: false, parent_portal: false } } }),
    );
    expect(hasFeature({ terms }, "analytics")).toBe(false);
    expect(hasFeature({ terms }, "parent_portal")).toBe(false);
    expect(hasFeature({ terms }, "cbt")).toBe(true);
  });

  it("names the feature it is blocking", () => {
    expect(featureBlockedMessage("analytics")).toContain("Analytics dashboards");
  });
});

describe("normaliseSeatLimit", () => {
  it("reads null, empty and unparseable values as unlimited", () => {
    expect(normaliseSeatLimit(null)).toBeNull();
    expect(normaliseSeatLimit(undefined)).toBeNull();
    expect(normaliseSeatLimit("")).toBeNull();
    expect(normaliseSeatLimit("unlimited")).toBeNull();
  });

  it("keeps zero as a real limit and rounds fractions down", () => {
    expect(normaliseSeatLimit(0)).toBe(0);
    expect(normaliseSeatLimit("0")).toBe(0);
    expect(normaliseSeatLimit(99.9)).toBe(99);
    expect(normaliseSeatLimit(-5)).toBe(0);
  });
});

describe("isSubscriptionLive", () => {
  it("keeps an active subscription live until its period ends", () => {
    expect(
      isSubscriptionLive({ status: "active", currentPeriodEnd: daysFromNow(1) }, now),
    ).toBe(true);
    expect(
      isSubscriptionLive({ status: "active", currentPeriodEnd: daysFromNow(-1) }, now),
    ).toBe(false);
  });

  it("treats a subscription with no end date as still live", () => {
    expect(isSubscriptionLive({ status: "active", currentPeriodEnd: null }, now)).toBe(true);
    expect(isSubscriptionLive({ status: "active", currentPeriodEnd: "" }, now)).toBe(true);
  });

  it("refuses canceled and inactive subscriptions however dated", () => {
    for (const status of ["canceled", "inactive", "past_due", "expired"] as const) {
      expect(
        isSubscriptionLive({ status, currentPeriodEnd: daysFromNow(30) }, now),
      ).toBe(false);
    }
    expect(isSubscriptionLive({ status: "trialing", currentPeriodEnd: daysFromNow(3) }, now)).toBe(true);
  });
});

describe("evaluateEntitlement", () => {
  it("is active on a paid plan with time left", () => {
    const entitlement = evaluateEntitlement({
      plan: plan(),
      subscription: {
        plan_id: "plan-1",
        status: "active",
        current_period_end: daysFromNow(12),
      },
      now,
    });
    expect(entitlement.state).toBe("active");
    expect(entitlement.terms.planName).toBe("Professional");
    expect(entitlement.terms.studentLimit).toBe(500);
    expect(hasFeature(entitlement, "analytics")).toBe(true);
  });

  it("expires the moment the billing period runs out", () => {
    const entitlement = evaluateEntitlement({
      plan: plan(),
      subscription: {
        plan_id: "plan-1",
        status: "active",
        current_period_end: daysFromNow(-1),
      },
      now,
    });
    expect(entitlement.state).toBe("expired");
    expect(entitlement.message).toContain("ended");
  });

  it("expires a canceled subscription with time still on the period", () => {
    const entitlement = evaluateEntitlement({
      plan: plan(),
      subscription: {
        plan_id: "plan-1",
        status: "canceled",
        current_period_end: daysFromNow(20),
      },
      now,
    });
    expect(entitlement.state).toBe("expired");
  });

  it("grants a school that never subscribed a setup period", () => {
    const entitlement = evaluateEntitlement({
      schoolCreatedAt: now.toISOString(),
      graceDays: 30,
      now,
    });
    expect(entitlement.state).toBe("grace");
    expect(entitlement.graceEndsAt).toBe(daysFromNow(30));
    expect(entitlement.terms.studentLimit).toBeNull();
    expect(entitlement.message).toContain("30 more days");
  });

  it("counts the last day of the setup period as still allowed", () => {
    const entitlement = evaluateEntitlement({
      schoolCreatedAt: daysFromNow(-29),
      graceDays: 30,
      now,
    });
    expect(entitlement.state).toBe("grace");
    expect(entitlement.message).toContain("1 more day");
  });

  it("expires a school past its setup period that never chose a plan", () => {
    const entitlement = evaluateEntitlement({
      schoolCreatedAt: daysFromNow(-31),
      graceDays: 30,
      now,
    });
    expect(entitlement.state).toBe("expired");
    expect(entitlement.terms.planName).toBeNull();
  });

  it("stays in the setup period when the school has no creation date", () => {
    expect(evaluateEntitlement({ schoolCreatedAt: null, now }).state).toBe("grace");
  });

  it("ignores a subscription row with no plan attached", () => {
    const entitlement = evaluateEntitlement({
      plan: null,
      subscription: { plan_id: null, status: "active", current_period_end: daysFromNow(5) },
      schoolCreatedAt: daysFromNow(-100),
      now,
    });
    expect(entitlement.state).toBe("expired");
  });

  it("uses the default setup period when none is configured", () => {
    const deadline = graceDeadline(now.toISOString());
    expect(deadline?.getTime()).toBe(now.getTime() + DEFAULT_GRACE_DAYS * 86400000);
  });
});

describe("evaluateSeat", () => {
  const active = evaluateEntitlement({
    plan: plan({ student_limit: 3, teacher_limit: 1 }),
    subscription: { plan_id: "plan-1", status: "active", current_period_end: daysFromNow(5) },
    now,
  });

  it("allows additions that fit", () => {
    const decision = evaluateSeat({ entitlement: active, kind: "student", used: 2, adding: 1 });
    expect(decision.allowed).toBe(true);
    expect(decision.remaining).toBe(1);
    expect(decision.message).toBe("");
  });

  it("refuses the addition that would cross the limit", () => {
    const decision = evaluateSeat({ entitlement: active, kind: "student", used: 3, adding: 1 });
    expect(decision.allowed).toBe(false);
    expect(decision.remaining).toBe(0);
    expect(decision.message).toContain("up to 3 students");
    expect(decision.message).toContain("upgrade");
  });

  it("says how many are left when the batch only partly fits", () => {
    const decision = evaluateSeat({ entitlement: active, kind: "student", used: 2, adding: 5 });
    expect(decision.allowed).toBe(false);
    expect(decision.message).toContain("Remove 4 students");
  });

  it("counts students and teachers against their own limits", () => {
    expect(evaluateSeat({ entitlement: active, kind: "student", used: 3, adding: 1 }).allowed).toBe(false);
    expect(evaluateSeat({ entitlement: active, kind: "teacher", used: 1, adding: 1 }).allowed).toBe(false);
    expect(evaluateSeat({ entitlement: active, kind: "teacher", used: 0, adding: 1 }).allowed).toBe(true);
  });

  it("treats a null limit as unlimited", () => {
    const entitlement = evaluateEntitlement({
      plan: plan({ student_limit: null, teacher_limit: null }),
      subscription: { plan_id: "plan-1", status: "active", current_period_end: daysFromNow(5) },
      now,
    });
    const decision = evaluateSeat({ entitlement, kind: "student", used: 100000, adding: 1 });
    expect(decision.limit).toBeNull();
    expect(decision.remaining).toBeNull();
    expect(decision.allowed).toBe(true);
  });

  it("issues no new seat once the subscription has lapsed", () => {
    const lapsed = evaluateEntitlement({
      plan: plan({ student_limit: 500 }),
      subscription: { plan_id: "plan-1", status: "active", current_period_end: daysFromNow(-1) },
      now,
    });
    const decision = evaluateSeat({ entitlement: lapsed, kind: "student", used: 4, adding: 1 });
    expect(decision.limit).toBe(0);
    expect(decision.allowed).toBe(false);
    expect(decision.message).toBe(lapsed.message);
  });

  it("issues no new seat during a setup period that has ended", () => {
    const expired = evaluateEntitlement({
      schoolCreatedAt: daysFromNow(-60),
      graceDays: 30,
      now,
    });
    expect(evaluateSeat({ entitlement: expired, kind: "teacher", used: 0, adding: 1 }).allowed).toBe(false);
    expect(evaluateSeat({ entitlement: expired, kind: "student", used: 12, adding: 0 }).allowed).toBe(true);
  });

  it("keeps letting a school over its limit do nothing at all", () => {
    const overLimit = evaluateEntitlement({
      plan: plan({ student_limit: 2 }),
      subscription: { plan_id: "plan-1", status: "active", current_period_end: daysFromNow(5) },
      now,
    });
    expect(evaluateSeat({ entitlement: overLimit, kind: "student", used: 9, adding: 0 }).allowed).toBe(true);
    expect(evaluateSeat({ entitlement: overLimit, kind: "student", used: 9, adding: 1 }).allowed).toBe(false);
  });
});
