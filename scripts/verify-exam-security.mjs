// Proves the practice-attempt integrity trail (spec section 29) against the
// real database.
//
// Migration 0030_practice_attempt_integrity.sql adds device_info and
// suspicious_activity to practice_attempts — the live CBT table — so the app
// has somewhere to record tab switches, blocked copy/paste attempts and the
// device a paper was sat on. (The legacy examination_attempts table had those
// columns in 0001, but the application never used it.)
//
// This harness proves:
//   * both columns exist and accept a device object plus an event list;
//   * the trail must stay a JSON array (a check constraint, not app discipline);
//   * a student can read their own trail but cannot edit or erase it — there
//     is no student update policy on practice_attempts, and the application
//     writes the trail with the service role;
//   * the trail never crosses tenants, and the series' teacher can read it.
//
// Run with: node scripts/verify-exam-security.mjs
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

const SAMPLE_EVENTS = [
  { type: "tab_hidden", at: "2026-01-01T10:00:00.000Z", detail: null },
  { type: "copy_attempt", at: "2026-01-01T10:00:05.000Z", detail: null },
  { type: "fullscreen_exit", at: "2026-01-01T10:00:09.000Z", detail: "Focus mode ended" },
];

const SAMPLE_DEVICE = {
  userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile Safari/537.36",
  platform: "Linux armv81",
  language: "en-NG",
  timezone: "Africa/Lagos",
  connection: "4g",
  screenWidth: 390,
  screenHeight: 844,
  viewportWidth: 390,
  viewportHeight: 844,
  devicePixelRatio: 3,
};

const run = async () => {
  const stamp = Date.now();
  const made = { users: [], schools: [], attempts: [], series: [] };

  try {
    // --- fixtures ---------------------------------------------------------
    const make = async (name) => {
      const email = `examsec-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${stamp}@verify.test`;
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

    const schoolAdmin = await make("School Admin");
    const teacherA = await make("Teacher A");
    const studentA = await make("Student A");
    const studentB = await make("Student B");
    const schoolAdminB = await make("School Admin B");

    const createSchool = async (label) => {
      const { data, error } = await admin
        .from("schools")
        .insert({ name: `Exam Security ${label} ${stamp}`, slug: `exam-sec-${label}-${stamp}` })
        .select("id")
        .single();
      if (error || !data) throw new Error(`school ${label}: ${error?.message ?? "no row"}`);
      made.schools.push(data.id);
      return data.id;
    };

    const schoolA = await createSchool("a");
    const schoolB = await createSchool("b");

    for (const [userId, role, school] of [
      [schoolAdmin, "SCHOOL_ADMIN", schoolA],
      [teacherA, "TEACHER", schoolA],
      [studentA, "STUDENT", schoolA],
      [studentB, "STUDENT", schoolB],
      [schoolAdminB, "SCHOOL_ADMIN", schoolB],
    ]) {
      const { error } = await admin
        .from("user_roles")
        .insert({ user_id: userId, school_id: school, role });
      if (error) throw new Error(`role ${role}: ${error.message}`);
    }

    // students rows (the student_id FK on practice_attempts points here)
    const studentRows = {};
    for (const [userId, school, label] of [
      [studentA, schoolA, "A"],
      [studentB, schoolB, "B"],
    ]) {
      const { data, error } = await admin
        .from("students")
        .insert({
          school_id: school,
          user_id: userId,
          display_name: `Student ${label} ${stamp}`,
          admission_number: `EXSEC-${label}-${stamp}`,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`student ${label}: ${error?.message ?? "no row"}`);
      studentRows[label] = data.id;
    }

    // A published series in school A with one question, so the teacher's
    // ownership of the series and the attempt line up with the real product.
    const { data: seriesRow, error: seriesError } = await admin
      .from("exam_series")
      .insert({
        school_id: schoolA,
        exam_type: "school",
        title: `Integrity Paper ${stamp}`,
        status: "published",
        created_by: teacherA,
      })
      .select("id")
      .single();
    if (seriesError || !seriesRow) throw new Error(`series: ${seriesError?.message ?? "no row"}`);
    made.series.push(seriesRow.id);

    const { data: bankRow } = await admin
      .from("question_banks")
      .insert({ school_id: schoolA, name: `Integrity Bank ${stamp}`, created_by: teacherA })
      .select("id")
      .single();
    if (!bankRow) throw new Error("question bank insert failed");

    const { data: questionRow } = await admin
      .from("questions")
      .insert({
        school_id: schoolA,
        question_bank_id: bankRow.id,
        question_text: "Which planet is known as the Red Planet?",
        question_type: "multiple_choice",
      })
      .select("id")
      .single();
    if (!questionRow) throw new Error("question insert failed");

    // The attempt under test (in progress, as the app leaves it mid-paper).
    const { data: attemptRow, error: attemptError } = await admin
      .from("practice_attempts")
      .insert({
        school_id: schoolA,
        exam_series_id: seriesRow.id,
        student_id: studentRows.A,
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (attemptError || !attemptRow) {
      throw new Error(`attempt: ${attemptError?.message ?? "no row"}`);
    }
    made.attempts.push(attemptRow.id);

    const asStudentA = await clientAs(studentA);
    const asStudentB = await clientAs(studentB);
    const asTeacherA = await clientAs(teacherA);
    const asSchoolAdmin = await clientAs(schoolAdmin);

    // --- columns exist ----------------------------------------------------
    console.log("\nSchema: the trail lives on practice_attempts");
    const columnProbe = await admin
      .from("practice_attempts")
      .select("device_info, suspicious_activity")
      .limit(1);
    check(
      "practice_attempts exposes device_info and suspicious_activity",
      !columnProbe.error,
      columnProbe.error?.message,
    );

    // --- the service-role write path --------------------------------------
    console.log("\nWrites: the service role records the trail");
    const writeTrail = await admin
      .from("practice_attempts")
      .update({ device_info: SAMPLE_DEVICE, suspicious_activity: SAMPLE_EVENTS })
      .eq("id", attemptRow.id)
      .select("device_info, suspicious_activity");
    check(
      "a device object and an event list are stored together",
      !writeTrail.error && writeTrail.data?.length === 1,
      writeTrail.error?.message,
    );

    // --- the array constraint ---------------------------------------------
    console.log("\nConstraint: the trail must stay a list of events");
    const objectTrail = await admin
      .from("practice_attempts")
      .update({ suspicious_activity: { type: "tab_hidden" } })
      .eq("id", attemptRow.id);
    check(
      "a JSON object is refused",
      !!objectTrail.error,
      objectTrail.error ? undefined : "the array check constraint is missing",
    );

    const stringTrail = await admin
      .from("practice_attempts")
      .update({ suspicious_activity: "nope" })
      .eq("id", attemptRow.id);
    check(
      "a JSON string is refused",
      !!stringTrail.error,
      stringTrail.error ? undefined : "the array check constraint is missing",
    );

    // Restore a clean trail for the read probes.
    await admin
      .from("practice_attempts")
      .update({ suspicious_activity: SAMPLE_EVENTS })
      .eq("id", attemptRow.id);

    // --- the candidate can read, never edit -------------------------------
    console.log("\nCandidate: read-only on their own trail");
    const ownRead = await asStudentA
      .from("practice_attempts")
      .select("id, device_info, suspicious_activity")
      .eq("id", attemptRow.id)
      .maybeSingle();
    check(
      "the student reads their own device info and trail",
      !ownRead.error &&
        Array.isArray(ownRead.data?.suspicious_activity) &&
        ownRead.data.suspicious_activity.length === 3 &&
        ownRead.data.device_info?.timezone === "Africa/Lagos",
      ownRead.error?.message ?? JSON.stringify(ownRead.data),
    );

    const tamper = await asStudentA
      .from("practice_attempts")
      .update({ suspicious_activity: [] })
      .eq("id", attemptRow.id)
      .select("id");
    check(
      "the student cannot wipe their own trail",
      !tamper.error && (tamper.data?.length ?? 0) === 0,
      tamper.error?.message ?? "a student updated practice_attempts",
    );

    const deviceTamper = await asStudentA
      .from("practice_attempts")
      .update({ device_info: null })
      .eq("id", attemptRow.id)
      .select("id");
    check(
      "the student cannot erase their device info",
      !deviceTamper.error && (deviceTamper.data?.length ?? 0) === 0,
      deviceTamper.error?.message ?? "a student cleared device_info",
    );

    // --- teachers and admins read it; tenants stay apart ------------------
    console.log("\nTeacher, admin and tenant boundary");
    const teacherRead = await asTeacherA
      .from("practice_attempts")
      .select("id, suspicious_activity")
      .eq("id", attemptRow.id)
      .maybeSingle();
    check(
      "the series' teacher reads the trail",
      !teacherRead.error && Array.isArray(teacherRead.data?.suspicious_activity),
      teacherRead.error?.message,
    );

    const adminRead = await asSchoolAdmin
      .from("practice_attempts")
      .select("id, suspicious_activity")
      .eq("id", attemptRow.id)
      .maybeSingle();
    check(
      "the school admin reads the trail",
      !adminRead.error && !!adminRead.data,
      adminRead.error?.message,
    );

    const crossRead = await asStudentB
      .from("practice_attempts")
      .select("id")
      .eq("id", attemptRow.id)
      .maybeSingle();
    check(
      "another school's student sees nothing",
      !crossRead.error && !crossRead.data,
      "the trail leaked across schools",
    );
  } catch (err) {
    failed++;
    console.log(`  FAIL  harness error: ${err?.message ?? err}`);
    if (err?.stack) console.log(err.stack);
  } finally {
    for (const attempt of made.attempts) {
      await admin.from("practice_attempts").delete().eq("id", attempt);
    }
    for (const series of made.series) {
      await admin.from("question_banks").delete().eq("exam_series_id", series);
      await admin.from("exam_series").delete().eq("id", series);
    }
    for (const userId of made.users) {
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
