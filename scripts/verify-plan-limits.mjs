// Proves the plan/entitlement layer's database half against the real schema.
//
// The judgements themselves (feature flags default on, grace vs expired, seat
// arithmetic) are pure and unit-tested in src/lib/entitlements.ts. What only
// the live database can prove is that:
//   * the plan rows carry feature_flags and seat limits faithfully (0 stays 0,
//     null stays unlimited);
//   * a school cannot forge its own entitlement any more — inserts/updates on
//     subscriptions and payments are platform-only after 0033 — while the
//     reads the billing page depends on still work;
//   * expire_due_subscriptions() flips only rows whose period has actually ended.
//
// Run with: node scripts/verify-plan-limits.mjs
// It writes only rows it creates, and removes them at the end.

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { installHttp1Fetch } from "./lib/http1-fetch.mjs";
installHttp1Fetch();

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL || !SERVICE || !ANON) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

async function clientAs(userId) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: (await admin.auth.admin.getUserById(userId)).data.user.email,
  });
  if (error) throw new Error(`generateLink failed: ${error.message}`);

  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: signInError } = await c.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });
  if (signInError) throw new Error(`verifyOtp failed: ${signInError.message}`);
  return c;
}

const run = async () => {
  const stamp = Date.now();
  const made = { users: [], schools: [], plans: [], subscriptions: [], payments: [] };

  try {
    // --- fixtures ---------------------------------------------------------
    const makeUser = async (name) => {
      const { data, error } = await admin.auth.admin.createUser({
        email: `planlimits-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${stamp}@verify.test`,
        email_confirm: true,
        user_metadata: { full_name: name },
      });
      if (error) throw new Error(`createUser ${name}: ${error.message}`);
      made.users.push(data.user.id);
      await admin.from("profiles").upsert({ id: data.user.id, full_name: name });
      return data.user.id;
    };

    const ownerUser = await makeUser("Owner");
    const teacherUser = await makeUser("Teacher");

    const { data: school, error: schoolError } = await admin
      .from("schools")
      .insert({ name: `Plan Limits ${stamp}`, slug: `plan-limits-${stamp}` })
      .select("id")
      .single();
    if (schoolError || !school) throw new Error(`school: ${schoolError?.message}`);
    made.schools.push(school.id);
    const schoolId = school.id;

    for (const [userId, role] of [
      [ownerUser, "SCHOOL_OWNER"],
      [teacherUser, "TEACHER"],
    ]) {
      const { error } = await admin
        .from("user_roles")
        .insert({ user_id: userId, school_id: schoolId, role });
      if (error) throw new Error(`role ${role}: ${error.message}`);
    }

    const { data: plan, error: planError } = await admin
      .from("subscription_plans")
      .insert({
        name: `Plan Limits Plan ${stamp}`,
        price: 0,
        billing_interval: "monthly",
        student_limit: 0,
        teacher_limit: 3,
        feature_limits: {
          features: ["Courses & lessons", "Assignments"],
          flags: { cbt: false, announcements: false },
        },
        status: "active",
      })
      .select("id, student_limit, teacher_limit, feature_limits")
      .single();
    if (planError || !plan) throw new Error(`plan: ${planError?.message}`);
    made.plans.push(plan.id);

    const { data: subscription, error: subscriptionError } = await admin
      .from("subscriptions")
      .insert({ school_id: schoolId, plan_id: plan.id, status: "active" })
      .select("id")
      .single();
    if (subscriptionError || !subscription) {
      throw new Error(`subscription: ${subscriptionError?.message}`);
    }
    made.subscriptions.push(subscription.id);

    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .insert({
        school_id: schoolId,
        subscription_id: subscription.id,
        provider: "paystack",
        provider_reference: `plan-limits-${stamp}`,
        amount: 1000,
        currency: "NGN",
        status: "paid",
      })
      .select("id")
      .single();
    if (paymentError || !payment) throw new Error(`payment: ${paymentError?.message}`);
    made.payments.push(payment.id);

    const asOwner = await clientAs(ownerUser);
    const asTeacher = await clientAs(teacherUser);

    // --- plan rows carry the terms ----------------------------------------
    console.log("\nPlan rows: seat limits and feature flags round-trip");
    check(
      "a seat limit of 0 stays 0 (it means 'no seats', not unlimited)",
      Number(plan.student_limit) === 0,
      `got ${JSON.stringify(plan.student_limit)}`,
    );
    check(
      "a teacher limit of 3 stays 3",
      Number(plan.teacher_limit) === 3,
      `got ${JSON.stringify(plan.teacher_limit)}`,
    );
    const flags = plan.feature_limits?.flags ?? null;
    check(
      "feature flags are stored alongside the marketing features list",
      Array.isArray(plan.feature_limits?.features) && flags?.cbt === false,
      JSON.stringify(plan.feature_limits),
    );
    check(
      "an owner reads the plan catalogue (public read intact)",
      (await asOwner.from("subscription_plans").select("id").eq("id", plan.id)).data?.length === 1,
      "subscription_plans is not readable",
    );

    // --- the billing page still works --------------------------------------
    console.log("\nBilling reads: admins keep their own ledger, nobody else does");
    const ownerSubscription = await asOwner
      .from("subscriptions")
      .select("id, status")
      .eq("school_id", schoolId);
    check(
      "the school owner can read their own subscription",
      !ownerSubscription.error && ownerSubscription.data?.length === 1,
      ownerSubscription.error?.message ?? `got ${ownerSubscription.data?.length} rows`,
    );
    check(
      "the school owner can read their own payments",
      (await asOwner.from("payments").select("id").eq("school_id", schoolId)).data?.length === 1,
      "payments are unreadable for admins",
    );
    check(
      "a teacher sees no payment rows for the school",
      (await asTeacher.from("payments").select("id").eq("school_id", schoolId)).data?.length === 0,
      "the money ledger leaked to a non-admin",
    );

    // --- the self-upgrade hole is closed -----------------------------------
    console.log("\nSubscription writes: platform only after 0033");
    const ownerInsert = await asOwner
      .from("subscriptions")
      .insert({ school_id: schoolId, plan_id: plan.id, status: "active" })
      .select("id");
    check(
      "a school owner cannot insert their own subscription",
      !!ownerInsert.error || ownerInsert.data?.length === 0,
      `insert returned ${JSON.stringify(ownerInsert.data ?? ownerInsert.error?.message)}`,
    );

    const ownerUpdate = await asOwner
      .from("subscriptions")
      .update({ status: "active" })
      .eq("school_id", schoolId)
      .select("id");
    check(
      "a school owner cannot update their own subscription",
      !!ownerUpdate.error || ownerUpdate.data?.length === 0,
      `updated ${ownerUpdate.data?.length} row(s)`,
    );

    const ownerPaymentUpdate = await asOwner
      .from("payments")
      .update({ status: "paid" })
      .eq("school_id", schoolId)
      .select("id");
    check(
      "a school owner cannot rewrite their own payment rows",
      !!ownerPaymentUpdate.error || ownerPaymentUpdate.data?.length === 0,
      `updated ${ownerPaymentUpdate.data?.length} row(s)`,
    );

    const ownerPaymentInsert = await asOwner
      .from("payments")
      .insert({
        school_id: schoolId,
        provider: "paystack",
        provider_reference: `forged-${stamp}`,
        amount: 0,
        currency: "NGN",
        status: "paid",
      })
      .select("id");
    check(
      "a school owner cannot forge a payment row",
      !!ownerPaymentInsert.error || ownerPaymentInsert.data?.length === 0,
      `insert returned ${JSON.stringify(ownerPaymentInsert.data ?? ownerPaymentInsert.error?.message)}`,
    );

    const platformInsert = await admin
      .from("subscriptions")
      .insert({ school_id: schoolId, status: "trialing" })
      .select("id")
      .single();
    if (!platformInsert.error && platformInsert.data) {
      made.subscriptions.push(platformInsert.data.id);
    }
    check(
      "the platform (service role) can still write subscriptions",
      !platformInsert.error,
      platformInsert.error?.message,
    );

    // --- the expiry sweep ---------------------------------------------------
    console.log("\nExpire sweep: only rows whose period has ended flip");
    const pastEnd = new Date(Date.now() - 86_400_000).toISOString();
    const futureEnd = new Date(Date.now() + 86_400_000).toISOString();

    const { data: dueRow, error: dueError } = await admin
      .from("subscriptions")
      .insert({
        school_id: schoolId,
        plan_id: plan.id,
        status: "active",
        current_period_end: pastEnd,
      })
      .select("id, status")
      .single();
    if (dueError || !dueRow) throw new Error(`due subscription: ${dueError?.message}`);
    made.subscriptions.push(dueRow.id);

    const { data: liveRow, error: liveError } = await admin
      .from("subscriptions")
      .insert({
        school_id: schoolId,
        plan_id: plan.id,
        status: "trialing",
        current_period_end: futureEnd,
      })
      .select("id, status")
      .single();
    if (liveError || !liveRow) throw new Error(`live subscription: ${liveError?.message}`);
    made.subscriptions.push(liveRow.id);

    const { data: flipped, error: rpcError } = await admin.rpc(
      "expire_due_subscriptions",
    );
    check(
      "expire_due_subscriptions() is callable by the service role",
      !rpcError && typeof flipped === "number",
      rpcError?.message ?? `got ${JSON.stringify(flipped)}`,
    );

    const { data: after } = await admin
      .from("subscriptions")
      .select("id, status")
      .in("id", [dueRow.id, liveRow.id]);
    const dueStatus = after?.find((r) => r.id === dueRow.id)?.status;
    const liveStatus = after?.find((r) => r.id === liveRow.id)?.status;
    check(
      "an ended subscription is marked expired",
      dueStatus === "expired",
      `got ${dueStatus}`,
    );
    check(
      "a subscription with time left is untouched",
      liveStatus === "trialing",
      `got ${liveStatus}`,
    );
  } catch (err) {
    failed++;
    console.log(`  FAIL  harness error: ${err?.message ?? err}`);
    if (err?.stack) console.log(err.stack);
  } finally {
    for (const payment of made.payments) {
      await admin.from("payments").delete().eq("id", payment);
    }
    for (const subscription of made.subscriptions) {
      await admin.from("subscriptions").delete().eq("id", subscription);
    }
    for (const plan of made.plans) {
      await admin.from("subscription_plans").delete().eq("id", plan);
    }
    for (const user of made.users) {
      await admin.auth.admin.deleteUser(user);
    }
    for (const school of made.schools) {
      await admin.from("payments").delete().eq("school_id", school);
      await admin.from("subscriptions").delete().eq("school_id", school);
      await admin.from("schools").delete().eq("id", school);
    }

    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
  }
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
