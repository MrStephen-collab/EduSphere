// Proves the per-user data preferences (spec section 50) against the real
// database.
//
// Migration 0031_user_data_preferences.sql adds user_data_preferences: one
// row per user holding a data mode (saver/balanced/high) and a video quality
// override (auto/360p/480p/720p). The school-side default already existed as
// school_settings.low_data_mode and is not changed here.
//
// This harness proves the policies do what the feature's honesty rests on:
//   * a learner can save and change their own preference, including through
//     the upsert the app actually issues;
//   * nobody can read, change or forge another person's row;
//   * the school admin can flip their own school's low-data default and no
//     other school's, and a student can read their own school's flag (that is
//     how an unchosen learner's default is resolved);
//   * a signed-out visitor sees nothing at all.
//
// Run with: node scripts/verify-data-preferences.mjs
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
  const made = { users: [], schools: [] };

  try {
    // --- fixtures ---------------------------------------------------------
    const make = async (name) => {
      const email = `datapref-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${stamp}@verify.test`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: name },
      });
      if (error) throw new Error(`createUser ${name}: ${error.message}`);
      made.users.push(data.user.id);
      await admin.from("profiles").upsert({ id: data.user.id, full_name: name });
      return data.user.id;
    };

    const adminA = await make("Admin A");
    const studentA = await make("Student A");
    const studentB = await make("Student B");
    const adminB = await make("Admin B");

    const createSchool = async (label) => {
      const { data, error } = await admin
        .from("schools")
        .insert({ name: `Data Pref ${label} ${stamp}`, slug: `data-pref-${label}-${stamp}` })
        .select("id")
        .single();
      if (error || !data) throw new Error(`school ${label}: ${error?.message ?? "no row"}`);
      made.schools.push(data.id);
      return data.id;
    };

    const schoolA = await createSchool("a");
    const schoolB = await createSchool("b");

    for (const [userId, role, school] of [
      [adminA, "SCHOOL_ADMIN", schoolA],
      [studentA, "STUDENT", schoolA],
      [studentB, "STUDENT", schoolB],
      [adminB, "SCHOOL_ADMIN", schoolB],
    ]) {
      const { error } = await admin
        .from("user_roles")
        .insert({ user_id: userId, school_id: school, role });
      if (error) throw new Error(`role ${role}: ${error.message}`);
    }

    for (const [userId, school, label] of [
      [studentA, schoolA, "A"],
      [studentB, schoolB, "B"],
    ]) {
      const { error } = await admin.from("students").insert({
        school_id: school,
        user_id: userId,
        display_name: `Student ${label} ${stamp}`,
        admission_number: `DATAPREF-${label}-${stamp}`,
      });
      if (error) throw new Error(`student ${label}: ${error.message}`);
    }

    // Normally created with the school; the harness inserts one so the
    // low-data default has a row to flip.
    const { error: settingsError } = await admin
      .from("school_settings")
      .insert({ school_id: schoolA, low_data_mode: false });
    if (settingsError) throw new Error(`school_settings: ${settingsError.message}`);

    const asAdminA = await clientAs(adminA);
    const asStudentA = await clientAs(studentA);
    const asStudentB = await clientAs(studentB);
    const asAdminB = await clientAs(adminB);

    // --- the table and its shape ------------------------------------------
    console.log("\nSchema: one preference row per person");
    const probe = await admin
      .from("user_data_preferences")
      .select("user_id, data_mode, video_quality")
      .limit(1);
    check(
      "user_data_preferences holds a mode and a video quality",
      !probe.error,
      probe.error?.message,
    );

    // --- the learner's own row --------------------------------------------
    console.log("\nLearner: owns their preference and only theirs");
    const insertOwn = await asStudentA
      .from("user_data_preferences")
      .insert({ user_id: studentA, data_mode: "saver", video_quality: "360p" })
      .select("data_mode, video_quality")
      .single();
    check(
      "a learner saves their own preference",
      !insertOwn.error &&
        insertOwn.data?.data_mode === "saver" &&
        insertOwn.data?.video_quality === "360p",
      insertOwn.error?.message,
    );

    const updateOwn = await asStudentA
      .from("user_data_preferences")
      .update({ data_mode: "high", video_quality: "720p" })
      .eq("user_id", studentA)
      .select("data_mode, video_quality")
      .single();
    check(
      "and changes it later",
      !updateOwn.error &&
        updateOwn.data?.data_mode === "high" &&
        updateOwn.data?.video_quality === "720p",
      updateOwn.error?.message,
    );

    const badMode = await asStudentA
      .from("user_data_preferences")
      .update({ data_mode: "turbo" })
      .eq("user_id", studentA);
    check(
      "an unknown mode is refused",
      !!badMode.error,
      badMode.error ? undefined : "the enum accepted a mode outside the spec",
    );

    // The app's own call shape: upsert on user_id, first time then again.
    const upsertFirst = await asStudentB
      .from("user_data_preferences")
      .upsert(
        { user_id: studentB, data_mode: "balanced", video_quality: "auto" },
        { onConflict: "user_id" },
      )
      .select("data_mode")
      .single();
    check(
      "the app's upsert works for a first save",
      !upsertFirst.error && upsertFirst.data?.data_mode === "balanced",
      upsertFirst.error?.message,
    );

    const upsertAgain = await asStudentB
      .from("user_data_preferences")
      .upsert(
        { user_id: studentB, data_mode: "saver", video_quality: "480p" },
        { onConflict: "user_id" },
      )
      .select("data_mode, video_quality")
      .single();
    check(
      "and updates in place on the next save",
      !upsertAgain.error &&
        upsertAgain.data?.data_mode === "saver" &&
        upsertAgain.data?.video_quality === "480p",
      upsertAgain.error?.message,
    );

    // --- the tenant/person boundary ---------------------------------------
    console.log("\nBoundary: nobody reaches another person's row");
    const crossRead = await asStudentB
      .from("user_data_preferences")
      .select("user_id")
      .eq("user_id", studentA)
      .maybeSingle();
    check(
      "another learner cannot read it",
      !crossRead.error && !crossRead.data,
      "a preference leaked to another user",
    );

    const crossUpdate = await asStudentB
      .from("user_data_preferences")
      .update({ data_mode: "saver" })
      .eq("user_id", studentA)
      .select("user_id");
    check(
      "another learner cannot change it",
      !crossUpdate.error && (crossUpdate.data?.length ?? 0) === 0,
      crossUpdate.error?.message ?? "a foreign row was updated",
    );

    const forgedInsert = await asStudentA
      .from("user_data_preferences")
      .insert({ user_id: studentB, data_mode: "saver" })
      .select("user_id");
    check(
      "and nobody can write a row for someone else",
      !!forgedInsert.error,
      forgedInsert.error ? undefined : "a row was created for another user",
    );

    // --- the school default ------------------------------------------------
    console.log("\nSchool default: the flag only its own admin can set");
    const flipOwn = await asAdminA
      .from("school_settings")
      .update({ low_data_mode: true })
      .eq("school_id", schoolA)
      .select("low_data_mode")
      .single();
    check(
      "the school admin sets their own low-data default",
      !flipOwn.error && flipOwn.data?.low_data_mode === true,
      flipOwn.error?.message,
    );

    const flipOther = await asAdminB
      .from("school_settings")
      .update({ low_data_mode: true })
      .eq("school_id", schoolA)
      .select("school_id");
    check(
      "another school's admin cannot",
      !flipOther.error && (flipOther.data?.length ?? 0) === 0,
      flipOther.error?.message ?? "a foreign school's settings were changed",
    );

    const readOwnSetting = await asStudentA
      .from("school_settings")
      .select("low_data_mode")
      .eq("school_id", schoolA)
      .maybeSingle();
    check(
      "a learner reads their school's flag (how an unchosen default resolves)",
      !readOwnSetting.error && readOwnSetting.data?.low_data_mode === true,
      readOwnSetting.error?.message,
    );

    // --- signed out --------------------------------------------------------
    console.log("\nSigned out: nothing");
    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    const anonRead = await anon.from("user_data_preferences").select("user_id").limit(1);
    check(
      "a visitor with no session sees no rows",
      anonRead.error ? true : (anonRead.data?.length ?? 0) === 0,
      anonRead.error ? undefined : "preferences were visible without a session",
    );
  } catch (err) {
    failed++;
    console.log(`  FAIL  harness error: ${err?.message ?? err}`);
    if (err?.stack) console.log(err.stack);
  } finally {
    for (const userId of made.users) {
      await admin.from("user_data_preferences").delete().eq("user_id", userId);
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("students").delete().eq("user_id", userId);
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
    for (const school of made.schools) {
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
