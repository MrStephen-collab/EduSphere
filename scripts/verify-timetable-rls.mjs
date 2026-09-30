// Probes the timetable RLS policies against the real database.
//
// The interesting rule here is teaches_class(). 0012_attendance.sql lets any
// teacher in a school write any class's register and papers over it in
// TypeScript; 0019_timetable.sql puts the real rule in the database instead, so
// this harness exists to prove the policy denies rather than merely compiles.
//
// The harness builds one school with two classes, an admin, two teachers -- one
// of them assigned to a class, one not -- and a student, then signs in as each
// of them and checks what they can actually read and write. A second school
// exists only so the cross-tenant case is tested rather than assumed.
//
// Two things worth knowing when reading the assertions below:
//
//   - An INSERT that RLS rejects comes back as an error, so those probes check
//     for one.
//   - An UPDATE or DELETE that RLS rejects comes back as a successful 200 with
//     zero rows. Those probes re-read the row with the service role instead,
//     because checking for an error there would pass whether or not the policy
//     existed.
//
// Run with: node scripts/verify-timetable-rls.mjs
// It writes only rows it creates, and removes them at the end.

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

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

const countRows = (res) => (res.data ?? []).length;

const run = async () => {
  const stamp = Date.now();
  const made = { users: [], schools: [] };

  try {
    // --- fixtures ---------------------------------------------------------
    const make = async (name) => {
      const email = `tt-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${stamp}@verify.test`;
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
    const linkedTeacher = await make("Linked Teacher");
    const outsiderTeacher = await make("Outsider Teacher");
    const studentUser = await make("Student");
    const otherAdmin = await make("Other Admin");

    const createSchool = async (label) => {
      const { data, error } = await admin
        .from("schools")
        .insert({ name: `Timetable RLS ${label} ${stamp}`, slug: `tt-rls-${label}-${stamp}` })
        .select("id")
        .single();
      if (error || !data) throw new Error(`school ${label}: ${error?.message ?? "no row"}`);
      made.schools.push(data.id);
      return data.id;
    };

    const schoolId = await createSchool("a");
    const otherSchoolId = await createSchool("b");

    for (const [userId, role, school] of [
      [adminUser, "SCHOOL_ADMIN", schoolId],
      [linkedTeacher, "TEACHER", schoolId],
      [outsiderTeacher, "TEACHER", schoolId],
      [studentUser, "STUDENT", schoolId],
      [otherAdmin, "SCHOOL_ADMIN", otherSchoolId],
    ]) {
      const { error } = await admin
        .from("user_roles")
        .insert({ user_id: userId, school_id: school, role });
      if (error) throw new Error(`role ${role}: ${error.message}`);
    }

    const mkClass = async (school, name, order) => {
      const { data, error } = await admin
        .from("classes")
        .insert({ school_id: school, name, order })
        .select("id")
        .single();
      if (error) throw new Error(`class ${name}: ${error.message}`);
      return data.id;
    };

    const classA = await mkClass(schoolId, "JSS 1 A", 0);
    const classB = await mkClass(schoolId, "JSS 1 B", 1);

    const { data: subject } = await admin
      .from("subjects")
      .insert({ school_id: schoolId, name: `Mathematics ${stamp}`, code: "MTH" })
      .select("id")
      .single();
    if (!subject) throw new Error("subject: no row");

    const mkTeacherRow = async (userId) => {
      const { data, error } = await admin
        .from("teachers")
        .insert({ school_id: schoolId, user_id: userId, display_name: "T" })
        .select("id")
        .single();
      if (error) throw new Error(`teachers row: ${error.message}`);
      return data.id;
    };

    const linkedTeacherRow = await mkTeacherRow(linkedTeacher);
    const outsiderTeacherRow = await mkTeacherRow(outsiderTeacher);

    // Only the linked teacher is assigned to class A. The other is a teacher in
    // the same school with no classes at all, which is the case the policy has
    // to refuse.
    await admin
      .from("teacher_classes")
      .insert({ school_id: schoolId, teacher_id: linkedTeacherRow, class_id: classA });

    const { data: session } = await admin
      .from("academic_sessions")
      .insert({ school_id: schoolId, name: `2026/2027 ${stamp}`, is_current: true })
      .select("id")
      .single();
    if (!session) throw new Error("session: no row");

    const { data: period } = await admin
      .from("timetable_periods")
      .insert({
        school_id: schoolId,
        name: "Period 1",
        start_time: "08:00:00",
        end_time: "08:45:00",
        seq: 0,
      })
      .select("id")
      .single();
    if (!period) throw new Error("period: no row");

    const { data: entry } = await admin
      .from("timetable_entries")
      .insert({
        school_id: schoolId,
        session_id: session.id,
        class_id: classA,
        period_id: period.id,
        day_of_week: 1,
        subject_id: subject.id,
        teacher_id: linkedTeacherRow,
      })
      .select("id")
      .single();
    if (!entry) throw new Error("entry: no row");

    const asAdmin = await clientAs(adminUser);
    const asLinked = await clientAs(linkedTeacher);
    const asOutsider = await clientAs(outsiderTeacher);
    const asStudent = await clientAs(studentUser);
    const asOtherAdmin = await clientAs(otherAdmin);

    // --- periods are admin-only ------------------------------------------
    console.log("\nPeriods: school-wide shape is an admin decision");
    const adminPeriod = await asAdmin
      .from("timetable_periods")
      .insert({
        school_id: schoolId,
        name: "Period 2",
        start_time: "08:45:00",
        end_time: "09:30:00",
        seq: 1,
      })
      .select("id");
    check("admin CAN add a period", !adminPeriod.error, adminPeriod.error?.message);

    const teacherPeriod = await asLinked
      .from("timetable_periods")
      .insert({
        school_id: schoolId,
        name: "Sneaky 3",
        start_time: "09:30:00",
        end_time: "10:00:00",
        seq: 7,
      })
      .select("id");
    check(
      "database refuses a teacher adding a period",
      !!teacherPeriod.error,
      "a teacher moved the bell for the whole school",
    );

    const studentPeriod = await asStudent
      .from("timetable_periods")
      .insert({
        school_id: schoolId,
        name: "Sneaky 4",
        start_time: "10:00:00",
        end_time: "10:30:00",
        seq: 8,
      })
      .select("id");
    check(
      "database refuses a student adding a period",
      !!studentPeriod.error,
      "a student edited the school day",
    );

    const { data: periodAfterTeacher } = await admin
      .from("timetable_periods")
      .select("id")
      .eq("school_id", schoolId)
      .eq("seq", 7);
    check(
      "the refused period really does not exist",
      countRows({ data: periodAfterTeacher }) === 0,
    );

    // --- reading the grid -------------------------------------------------
    console.log("\nGrid: everyone in the school may read it");
    check(
      "the assigned teacher CAN read the grid",
      countRows(
        await asLinked
          .from("timetable_entries")
          .select("id")
          .eq("id", entry.id),
      ) === 1,
    );
    check(
      "a teacher with no classes CAN still read the grid",
      countRows(
        await asOutsider
          .from("timetable_entries")
          .select("id")
          .eq("id", entry.id),
      ) === 1,
      "a timetable a colleague teaches is not a secret",
    );
    check(
      "a student CAN read the grid -- this is the point of the feature",
      countRows(
        await asStudent.from("timetable_entries").select("id").eq("id", entry.id),
      ) === 1,
    );
    check(
      "an admin of another school CANNOT read this grid",
      countRows(
        await asOtherAdmin
          .from("timetable_entries")
          .select("id")
          .eq("id", entry.id),
      ) === 0,
      "cross-tenant timetable leak",
    );
    check(
      "the other school's admin cannot list this school's periods",
      countRows(
        await asOtherAdmin.from("timetable_periods").select("id").eq("school_id", schoolId),
      ) === 0,
      "cross-tenant period leak",
    );

    // --- the actual rule: teaches_class ----------------------------------
    console.log("\nEntries: a teacher edits their own classes and no others");
    const linkedInsert = await asLinked
      .from("timetable_entries")
      .insert({
        school_id: schoolId,
        session_id: session.id,
        class_id: classA,
        period_id: period.id,
        day_of_week: 2,
        subject_id: subject.id,
        teacher_id: linkedTeacherRow,
      })
      .select("id");
    check(
      "the assigned teacher CAN add a lesson to their class",
      !linkedInsert.error,
      linkedInsert.error?.message,
    );

    const outsiderInsert = await asOutsider
      .from("timetable_entries")
      .insert({
        school_id: schoolId,
        session_id: session.id,
        class_id: classA,
        period_id: period.id,
        day_of_week: 3,
        subject_id: subject.id,
        teacher_id: outsiderTeacherRow,
      })
      .select("id");
    check(
      "database refuses a teacher with no classes adding a lesson to one",
      !!outsiderInsert.error,
      "an unassigned teacher wrote into a class timetable",
    );

    const { data: afterOutsider } = await admin
      .from("timetable_entries")
      .select("id")
      .eq("class_id", classA)
      .eq("day_of_week", 3);
    check(
      "the refused lesson really does not exist",
      countRows({ data: afterOutsider }) === 0,
    );

    const studentInsert = await asStudent
      .from("timetable_entries")
      .insert({
        school_id: schoolId,
        session_id: session.id,
        class_id: classA,
        period_id: period.id,
        day_of_week: 4,
        subject_id: subject.id,
      })
      .select("id");
    check(
      "database refuses a student writing a lesson",
      !!studentInsert.error,
      "a student wrote into a class timetable",
    );

    const adminInsert = await asAdmin
      .from("timetable_entries")
      .insert({
        school_id: schoolId,
        session_id: session.id,
        class_id: classB,
        period_id: period.id,
        day_of_week: 5,
        subject_id: subject.id,
        teacher_id: outsiderTeacherRow,
      })
      .select("id");
    check(
      "admin CAN add a lesson to any class",
      !adminInsert.error,
      adminInsert.error?.message,
    );

    // --- update and delete: filtered, not rejected ------------------------
    console.log("\nEntries: updates and deletes");
    await asOutsider
      .from("timetable_entries")
      .update({ subject_id: null })
      .eq("id", entry.id);
    const { data: afterOutsiderUpdate } = await admin
      .from("timetable_entries")
      .select("subject_id")
      .eq("id", entry.id)
      .single();
    check(
      "an unassigned teacher's update changes nothing",
      afterOutsiderUpdate?.subject_id === subject.id,
      `subject_id is now ${afterOutsiderUpdate?.subject_id}`,
    );

    await asStudent.from("timetable_entries").delete().eq("id", entry.id);
    const { data: afterStudentDelete } = await admin
      .from("timetable_entries")
      .select("id")
      .eq("id", entry.id);
    check(
      "a student cannot delete a lesson",
      countRows({ data: afterStudentDelete }) === 1,
      "a lesson was deleted by a student",
    );

    await asOutsider.from("timetable_entries").delete().eq("id", entry.id);
    const { data: afterOutsiderDelete } = await admin
      .from("timetable_entries")
      .select("id")
      .eq("id", entry.id);
    check(
      "an unassigned teacher cannot delete a lesson",
      countRows({ data: afterOutsiderDelete }) === 1,
      "a lesson was deleted by a teacher with no classes",
    );

    // --- the database refuses a double booking of one class ---------------
    console.log("\nEntries: constraints");
    const duplicate = await asAdmin
      .from("timetable_entries")
      .insert({
        school_id: schoolId,
        session_id: session.id,
        class_id: classA,
        period_id: period.id,
        day_of_week: 1,
        subject_id: subject.id,
      })
      .select("id");
    check(
      "database refuses two lessons in the same class, day and period",
      !!duplicate.error,
      "a class was scheduled into the same period twice",
    );

    const sunday = await asAdmin
      .from("timetable_entries")
      .insert({
        school_id: schoolId,
        session_id: session.id,
        class_id: classB,
        period_id: period.id,
        day_of_week: 7,
        subject_id: subject.id,
      })
      .select("id");
    check(
      "database refuses a lesson on a day the grid cannot render",
      !!sunday.error,
      "a Sunday lesson exists that no page can show",
    );

    // --- the helper itself ------------------------------------------------
    const { error: helperErr } = await admin.rpc("teaches_class", {
      p_class_id: classA,
      p_school_id: schoolId,
    });
    check(
      "teaches_class() exists and is callable",
      !helperErr,
      helperErr?.message ?? "(service role sees true for everyone, which is expected)",
    );
    if (!helperErr) {
      const { data: asSelf } = await asLinked.rpc("teaches_class", {
        p_class_id: classA,
        p_school_id: schoolId,
      });
      const { data: asSelfOther } = await asLinked.rpc("teaches_class", {
        p_class_id: classB,
        p_school_id: schoolId,
      });
      check("teaches_class() says yes for the teacher's own class", asSelf === true);
      check("teaches_class() says no for a class they are not assigned to", asSelfOther === false);
    }
  } catch (err) {
    failed++;
    console.log(`  FAIL  harness error: ${err?.message ?? err}`);
    if (err?.stack) console.log(err.stack);
  } finally {
    // Entries and periods cascade from the school, so deleting the school is
    // enough; only the users need clearing first, because auth.users is not
    // owned by the school.
    for (const userId of made.users) {
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("teacher_classes").delete().eq("teacher_id", userId);
      await admin.from("teachers").delete().eq("user_id", userId);
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
    for (const schoolId of made.schools) {
      await admin.from("schools").delete().eq("id", schoolId);
    }

    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
  }
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
