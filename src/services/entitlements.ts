import { createAdminClient } from "@/lib/supabase/admin";
import { getServerData, invalidateCacheByPrefix } from "@/lib/server-cache";
import {
  DEFAULT_GRACE_DAYS,
  evaluateEntitlement,
  evaluateSeat,
  featureBlockedMessage,
  hasFeature,
  isSubscriptionLive,
  type Entitlement,
  type EntitlementState,
  type PlanFeatureKey,
  type SeatKind,
} from "@/lib/entitlements";
import { asArray } from "@/lib/embed";
import type { Subscription, SubscriptionPlan } from "@/types/database";

const CACHE_TTL_MS = 15_000;

type SubscriptionRow = Subscription & {
  plans: SubscriptionPlan | SubscriptionPlan[] | null;
};

function configuredGraceDays(): number {
  const raw = process.env.SUBSCRIPTION_GRACE_DAYS;
  if (!raw) return DEFAULT_GRACE_DAYS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_GRACE_DAYS;
  return Math.trunc(parsed);
}

export function invalidateEntitlementCache(schoolId?: string): void {
  invalidateCacheByPrefix(schoolId ? `entitlement:${schoolId}` : "entitlement:");
}

/**
 * The terms a school is on right now.
 *
 * Read through the service role rather than the caller's session, because a
 * school's plan has to be readable by every role that can hit a gated action -
 * a teacher creating an assignment is exactly who the switch has to stop, and
 * a teacher's session cannot read `subscriptions` at all. The `schoolId` is
 * always one the caller has already proved membership of.
 */
export async function getSchoolEntitlement(schoolId: string): Promise<Entitlement> {
  return getServerData(`entitlement:${schoolId}`, CACHE_TTL_MS, () =>
    loadEntitlement(schoolId),
  );
}

async function loadEntitlement(schoolId: string): Promise<Entitlement> {
  const admin = createAdminClient();

  const [{ data: subData }, { data: schoolData }] = await Promise.all([
    admin
      .from("subscriptions")
      .select("*, plans:subscription_plans(*)")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("schools").select("created_at").eq("id", schoolId).maybeSingle(),
  ]);

  const row = (subData ?? null) as SubscriptionRow | null;
  const plan = row ? (asArray(row.plans)[0] ?? null) : null;
  const schoolCreatedAt =
    (schoolData as { created_at?: string | null } | null)?.created_at ?? null;

  let status = row?.status ?? null;
  if (row && (row.status === "active" || row.status === "trialing")) {
    const stillLive = isSubscriptionLive({
      status: row.status,
      currentPeriodEnd: row.current_period_end,
    });
    if (!stillLive) {
      status = "expired";
      await admin
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("id", row.id)
        .eq("school_id", schoolId);
      await admin.from("audit_logs").insert({
        school_id: schoolId,
        action: "subscription_expired",
        entity_type: "subscriptions",
        entity_id: row.id,
        metadata: {
          plan_id: row.plan_id,
          previous_status: row.status,
          period_end: row.current_period_end,
        },
      });
    }
  }

  return evaluateEntitlement({
    plan,
    subscription: row
      ? {
          plan_id: row.plan_id,
          status: status ?? "inactive",
          current_period_end: row.current_period_end,
        }
      : null,
    schoolCreatedAt,
    graceDays: configuredGraceDays(),
  });
}

async function countSeats(schoolId: string, kind: SeatKind): Promise<number> {
  const admin = createAdminClient();
  const query =
    kind === "student"
      ? admin.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId)
      : admin.from("teachers").select("id", { count: "exact", head: true }).eq("school_id", schoolId);

  const { count, error } = await query;
  if (error) throw new Error("We couldn't check how many people your school already has.");
  return count ?? 0;
}

export type SeatCapacity = {
  kind: SeatKind;
  used: number;
  limit: number | null;
  remaining: number | null;
  state: EntitlementState;
  entitlement: Entitlement;
  planMessage: string;
};

/**
 * How many more of this kind the school may add, without throwing.
 *
 * Used by bulk paths, where a whole CSV has to be fitted to the limit a row at
 * a time rather than refused up front for a batch that may contain duplicates.
 */
export async function getSeatCapacity(
  schoolId: string,
  kind: SeatKind,
): Promise<SeatCapacity> {
  const [entitlement, used] = await Promise.all([
    getSchoolEntitlement(schoolId),
    countSeats(schoolId, kind),
  ]);
  const decision = evaluateSeat({ entitlement, kind, used, adding: 0 });

  return {
    kind,
    used: decision.used,
    limit: decision.limit,
    remaining: decision.remaining,
    state: entitlement.state,
    entitlement,
    planMessage: entitlement.message,
  };
}

export async function assertSeatAvailable(
  schoolId: string,
  kind: SeatKind,
  adding: number,
): Promise<void> {
  if (adding <= 0) return;

  const [entitlement, used] = await Promise.all([
    getSchoolEntitlement(schoolId),
    countSeats(schoolId, kind),
  ]);
  const decision = evaluateSeat({ entitlement, kind, used, adding });
  if (!decision.allowed) throw new Error(decision.message);
}

export async function planFeatureEnabled(
  schoolId: string,
  key: PlanFeatureKey,
): Promise<boolean> {
  const entitlement = await getSchoolEntitlement(schoolId);
  return hasFeature(entitlement, key);
}

export async function assertPlanFeature(
  schoolId: string,
  key: PlanFeatureKey,
): Promise<void> {
  if (!(await planFeatureEnabled(schoolId, key))) {
    throw new Error(featureBlockedMessage(key));
  }
}
