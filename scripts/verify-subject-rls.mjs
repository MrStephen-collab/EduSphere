// Probes the subjects RLS policies against the real database.
//
// 0002 gave subjects the generic school-admin-only write policies (via the
// table loop):
//
//   insert/update/delete using (is_super_admin() or is_school_admin(school_id))
//
// Teachers had read access (is_school_member) but no write access, so a teacher
// working in a primary or secondary school — where courses and lessons do not
// exist — could not create the subjects that classes, assignments and results
// hang off. 0029_teacher_subject_management.sql replaces those three policies
// with editor policies that also accept is_teacher(school_id).
//
// This harness proves the widening is real and still tenant-scoped: a teacher
// can write their own school's subjects, a teacher in another school cannot,
// a pupil cannot, and the admin path is unchanged.
//
// Run with: node scripts/verify-subject-rls.mjs
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

const idsOf = (res) => (res.data ?? []).map((r) => r.id);

const run = async () => {
  const stamp = Date.now();
  const made = { users: [], schools: [] };

  try {
    // --- fixtures ---------------------------------------------------------
    const make = async (name) => {
      const email = `subj-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${stamp}@verify.test`;
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

    const adminUser = await make("Admin");
    const teacherA = await make("Teacher A");
    const teacherB = await make("Teacher B");
    const pupil = await make("Pupil");

    const createSchool = async (label) => {
      const { data, error } = await admin
        .from("schools")
        .insert({ name: `Subjects RLS ${label} ${stamp}`, slug: `subj-rls-${label}-${stamp}` })
        .select("id")
        .single();
      if (error || !data) throw new Error(`school ${label}: ${error?.message ?? "no row"}`);
      made.schools.push(data.id);
      return data.id;
    };

    const schoolA = await createSchool("a");
    const schoolB = await createSchool("b");

    for (const [userId, role, school] of [
      [adminUser, "SCHOOL_ADMIN", schoolA],
      [teacherA, "TEACHER", schoolA],
      [teacherB, "TEACHER", schoolB],
      [pupil, "STUDENT", schoolA],
    ]) {
      const { error } = await admin
        .from("user_roles")
        .insert({ user_id: userId, school_id: school, role });
      if (error) throw new Error(`role ${role}: ${error.message}`);
    }

    // A pre-existing subject in school A, for update/delete probes.
    const { data: existing, error: seedError } = await admin
      .from("subjects")
      .insert({ school_id: schoolA, name: `Mathematics ${stamp}`, code: "MTH" })
      .select("id")
      .single();
    if (seedError || !existing) throw new Error(`seed subject: ${seedError?.message ?? "no row"}`);
    const existingSubject = existing.id;

    const asAdmin = await clientAs(adminUser);
    const asTeacherA = await clientAs(teacherA);
    const asTeacherB = await clientAs(teacherB);
    const asPupil = await clientAs(pupil);

    // --- reads ------------------------------------------------------------
    console.log("\nReads: school-scoped for everyone");
    check(
      "teacher in school A reads school A's subject",
      idsOf(await asTeacherA.from("subjects").select("id").eq("school_id", schoolA)).includes(
        existingSubject,
      ),
      "a teacher could not see their own school's subject",
    );
    check(
      "teacher in school B reads nothing from school A",
      (await asTeacherB.from("subjects").select("id").eq("school_id", schoolA)).data?.length === 0,
      "subjects leaked across schools",
    );

    // --- the widening: teachers can write ---------------------------------
    console.log("\nWrites: teachers may manage their own school's subjects");
    const teacherInsert = await asTeacherA
      .from("subjects")
      .insert({ school_id: schoolA, name: `Physics ${stamp}`, code: "PHY" })
      .select("id")
      .single();
    check(
      "database allows a teacher to add a subject to their own school",
      !teacherInsert.error && !!teacherInsert.data,
      teacherInsert.error?.message,
    );

    const teacherUpdate = await asTeacherA
      .from("subjects")
      .update({ name: `Physics II ${stamp}` })
      .eq("id", existingSubject)
      .select("id");
    check(
      "database allows a teacher to rename a subject in their own school",
      idsOf(teacherUpdate).includes(existingSubject),
      "a teacher could not update a subject",
    );

    // --- admin path unchanged ---------------------------------------------
    const adminInsert = await asAdmin
      .from("subjects")
      .insert({ school_id: schoolA, name: `Chemistry ${stamp}`, code: "CHM" })
      .select("id")
      .single();
    check(
      "school admin can still add a subject (regression)",
      !adminInsert.error && !!adminInsert.data,
      adminInsert.error?.message,
    );

    // --- the boundary: teachers cannot cross tenants, pupils cannot write
    console.log("\nBoundaries: another school's teacher and pupils are refused");
    const crossInsert = await asTeacherB
      .from("subjects")
      .insert({ school_id: schoolA, name: `Sneaky ${stamp}`, code: "SNK" })
      .select("id");
    check(
      "database refuses a teacher adding a subject to another school",
      !!crossInsert.error,
      "a teacher crossed a tenant boundary",
    );

    const crossUpdate = await asTeacherB
      .from("subjects")
      .update({ name: `Hijacked ${stamp}` })
      .eq("id", existingSubject)
      .select("id");
    check(
      "database refuses a teacher renaming another school's subject",
      !idsOf(crossUpdate).includes(existingSubject),
      "a teacher edited another school's subject",
    );

    const pupilInsert = await asPupil
      .from("subjects")
      .insert({ school_id: schoolA, name: `Rogue ${stamp}`, code: "RGE" })
      .select("id");
    check(
      "database refuses a pupil adding a subject",
      !!pupilInsert.error,
      "a pupil created a subject",
    );

    // --- the delete that motivated the editor policy ----------------------
    const createdId = teacherInsert.data?.id;
    if (createdId) {
      const teacherDelete = await asTeacherA
        .from("subjects")
        .delete()
        .eq("id", createdId)
        .select("id");
      check(
        "database allows a teacher to delete a subject they created",
        idsOf(teacherDelete).includes(createdId),
        "a teacher could not delete a subject",
      );
    } else {
      check("database allows a teacher to delete a subject they created", false, "setup failed");
    }
  } catch (err) {
    failed++;
    console.log(`  FAIL  harness error: ${err?.message ?? err}`);
    if (err?.stack) console.log(err.stack);
  } finally {
    for (const userId of made.users) {
      await admin.from("user_roles").delete().eq("user_id", userId);
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
