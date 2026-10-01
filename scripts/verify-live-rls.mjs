// Probes the live teaching RLS policies against the real database.
//
// 0020_live_sessions.sql has three rules worth proving rather than assuming:
//
//   1. An unannounced session is invisible to students. A join link the teacher
//      has not tested should not be readable by a class, and the student list
//      is built on this policy.
//   2. A teacher writes only the classes they are assigned to (teaches_class),
//      the same rule as the timetable.
//   3. Attendance reads are narrower than "members of the school". 0020 granted
//      them to is_school_member, which includes pupils, so any student could
//      select the whole register of every class in the school. 0021 narrowed it
//      to: managers, the teacher who owns the class, and the pupil the row is
//      about. The cross-student read below is the regression test for that.
//
// The harness builds one school with two classes, an admin, two teachers -- one
// assigned to a class, one not -- and two students in the same class, so the
// "student A cannot read student B's mark" case has something to fail on. A
// second school exists only so the cross-tenant case is tested, not assumed.
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
// Run with: node scripts/verify-live-rls.mjs
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
      const email = `live-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${stamp}@verify.test`;
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
    const studentOneUser = await make("Student One");
    const studentTwoUser = await make("Student Two");
    const otherAdmin = await make("Other Admin");

    const createSchool = async (label) => {
      const { data, error } = await admin
        .from("schools")
        .insert({ name: `Live RLS ${label} ${stamp}`, slug: `live-rls-${label}-${stamp}` })
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
      [studentOneUser, "STUDENT", schoolId],
      [studentTwoUser, "STUDENT", schoolId],
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
    // The outsider is a teacher in this school with no classes, which is the
    // case the policy has to refuse. The row itself is never referenced again.
    await mkTeacherRow(outsiderTeacher);

    await admin
      .from("teacher_classes")
      .insert({ school_id: schoolId, teacher_id: linkedTeacherRow, class_id: classA });

    // Two pupils in the same class, so "a student reads only their own mark" is a
    // statement about a competing row rather than an empty result.
    const mkStudent = async (userId, name, admission) => {
      const { data, error } = await admin
        .from("students")
        .insert({
          school_id: schoolId,
          user_id: userId,
          class_id: classA,
          display_name: name,
          admission_number: admission,
        })
        .select("id")
        .single();
      if (error) throw new Error(`student ${name}: ${error.message}`);
      return data.id;
    };

    const studentOne = await mkStudent(studentOneUser, "Student One", `LV-${stamp}-1`);
    const studentTwo = await mkStudent(studentTwoUser, "Student Two", `LV-${stamp}-2`);

    const HOUR = 3_600_000;
    const now = Date.now();

    const mkSession = async (over) => {
      const { data, error } = await admin
        .from("live_sessions")
        .insert({
          school_id: schoolId,
          class_id: classA,
          title: "Verification session",
          join_url: "https://zoom.us/j/1234567890",
          starts_at: new Date(now + HOUR).toISOString(),
          ends_at: new Date(now + 2 * HOUR).toISOString(),
          status: "scheduled",
          is_visible_to_students: true,
          created_by: linkedTeacher,
          ...over,
        })
        .select("id")
        .single();
      if (error) throw new Error(`live_sessions: ${error.message}`);
      return data.id;
    };

    const announced = await mkSession({});
    const draft = await mkSession({
      title: "Not announced",
      is_visible_to_students: false,
      starts_at: new Date(now + 3 * HOUR).toISOString(),
      ends_at: new Date(now + 4 * HOUR).toISOString(),
    });

    const mkMark = async (sessionId, studentId, status = "present") => {
      const { data, error } = await admin
        .from("live_attendance_records")
        .insert({
          school_id: schoolId,
          live_session_id: sessionId,
          student_id: studentId,
          status,
          marked_by: linkedTeacher,
        })
        .select("id")
        .single();
      if (error) throw new Error(`live_attendance_records: ${error.message}`);
      return data.id;
    };

    const markOne = await mkMark(announced, studentOne, "present");
    const markTwo = await mkMark(announced, studentTwo, "absent");

    const asAdmin = await clientAs(adminUser);
    const asLinked = await clientAs(linkedTeacher);
    const asOutsider = await clientAs(outsiderTeacher);
    const asStudentOne = await clientAs(studentOneUser);
    const asStudentTwo = await clientAs(studentTwoUser);
    const asOtherAdmin = await clientAs(otherAdmin);

    // --- announcement is the visibility gate ------------------------------
    console.log("\nSessions: unannounced sessions stay out of the student's list");
    check(
      "the assigned teacher CAN read an announced session",
      countRows(
        await asLinked.from("live_sessions").select("id").eq("id", announced),
      ) === 1,
    );
    check(
      "the assigned teacher CAN read their own draft",
      countRows(await asLinked.from("live_sessions").select("id").eq("id", draft)) === 1,
      "a teacher cannot see their own unscheduled draft",
    );
    check(
      "a student CAN read an announced session in their class",
      countRows(
        await asStudentOne.from("live_sessions").select("id").eq("id", announced),
      ) === 1,
      "the feature is pointless if a student cannot see the session",
    );
    check(
      "a student CANNOT read an unannounced session",
      countRows(await asStudentOne.from("live_sessions").select("id").eq("id", draft)) === 0,
      "an untested join link was readable by a class",
    );
    check(
      "a teacher with no classes in this class CANNOT read the session",
      countRows(await asOutsider.from("live_sessions").select("id").eq("id", announced)) === 0,
      "sessions leaked to unassigned teachers",
    );
    check(
      "an admin CAN read every session in their school",
      countRows(await asAdmin.from("live_sessions").select("id").eq("id", announced)) === 1,
    );
    check(
      "an admin of another school CANNOT read this session",
      countRows(
        await asOtherAdmin.from("live_sessions").select("id").eq("id", announced),
      ) === 0,
      "cross-tenant session leak",
    );

    // --- scheduling writes ------------------------------------------------
    console.log("\nSessions: who may schedule and announce");
    const teacherInsert = await asLinked
      .from("live_sessions")
      .insert({
        school_id: schoolId,
        class_id: classA,
        title: "Teacher's own class",
        join_url: "https://zoom.us/j/5550001111",
        starts_at: new Date(now + 5 * HOUR).toISOString(),
        ends_at: new Date(now + 6 * HOUR).toISOString(),
        is_visible_to_students: true,
      })
      .select("id");
    check(
      "the assigned teacher CAN schedule for their own class",
      !teacherInsert.error,
      teacherInsert.error?.message,
    );

    const outsiderInsert = await asOutsider
      .from("live_sessions")
      .insert({
        school_id: schoolId,
        class_id: classA,
        title: "Somebody else's class",
        join_url: "https://zoom.us/j/5550002222",
        starts_at: new Date(now + 5 * HOUR).toISOString(),
        ends_at: new Date(now + 6 * HOUR).toISOString(),
        is_visible_to_students: true,
      })
      .select("id");
    check(
      "the database refuses a teacher scheduling for a class they do not teach",
      !!outsiderInsert.error,
      "an unassigned teacher announced a session to another class",
    );

    const studentInsert = await asStudentOne
      .from("live_sessions")
      .insert({
        school_id: schoolId,
        class_id: classA,
        title: "Student's own class",
        join_url: "https://zoom.us/j/5550003333",
        starts_at: new Date(now + 5 * HOUR).toISOString(),
        ends_at: new Date(now + 6 * HOUR).toISOString(),
        is_visible_to_students: true,
      })
      .select("id");
    check(
      "the database refuses a student scheduling a session",
      !!studentInsert.error,
      "a student announced a join link to the class",
    );

    const { data: afterInserts } = await admin
      .from("live_sessions")
      .select("id")
      .eq("school_id", schoolId)
      .eq("title", "Somebody else's class");
    check("the refused session really does not exist", countRows({ data: afterInserts }) === 0);

    // --- the register -----------------------------------------------------
    console.log("\nRegister: reads are narrower than 'member of the school'");
    check(
      "the teacher who owns the class CAN read the register",
      countRows(await asLinked.from("live_attendance_records").select("id")) === 2,
    );
    check(
      "a manager CAN read the register",
      countRows(await asAdmin.from("live_attendance_records").select("id")) === 2,
    );
    check(
      "a pupil CAN read their own mark",
      countRows(
        await asStudentOne
          .from("live_attendance_records")
          .select("id")
          .eq("id", markOne),
      ) === 1,
    );
    check(
      "the other pupil CAN read their own mark too",
      countRows(
        await asStudentTwo
          .from("live_attendance_records")
          .select("id")
          .eq("id", markTwo),
      ) === 1,
      "the policy would be broken for every pupil but the first",
    );
    check(
      "the other pupil CANNOT read the first pupil's mark",
      countRows(
        await asStudentTwo
          .from("live_attendance_records")
          .select("id")
          .eq("id", markOne),
      ) === 0,
      "one pupil read another pupil's mark",
    );
    check(
      "a pupil CANNOT read another pupil's mark",
      countRows(
        await asStudentOne
          .from("live_attendance_records")
          .select("id")
          .eq("id", markTwo),
      ) === 0,
      "one pupil read the whole register of the class",
    );
    check(
      "a pupil listing the table gets only their own row",
      countRows(await asStudentOne.from("live_attendance_records").select("id")) === 1,
      "the select policy grants students the whole school register",
    );
    check(
      "a teacher with no classes CANNOT read the register",
      countRows(await asOutsider.from("live_attendance_records").select("id")) === 0,
      "a colleague's register leaked to an unassigned teacher",
    );
    check(
      "an admin of another school CANNOT read the register",
      countRows(await asOtherAdmin.from("live_attendance_records").select("id")) === 0,
      "cross-tenant register leak",
    );

    console.log("\nRegister: who may mark");
    const teacherMark = await asLinked
      .from("live_attendance_records")
      .upsert(
        {
          school_id: schoolId,
          live_session_id: announced,
          student_id: studentTwo,
          status: "late",
          marked_by: linkedTeacher,
        },
        { onConflict: "live_session_id,student_id" },
      )
      .select("id");
    check(
      "the assigned teacher CAN mark",
      !teacherMark.error,
      teacherMark.error?.message,
    );

    const { data: markedAs } = await admin
      .from("live_attendance_records")
      .select("status")
      .eq("id", markTwo)
      .maybeSingle();
    check("the mark really changed in the database", markedAs?.status === "late");

    const outsiderMark = await asOutsider
      .from("live_attendance_records")
      .upsert(
        {
          school_id: schoolId,
          live_session_id: announced,
          student_id: studentOne,
          status: "absent",
          marked_by: outsiderTeacher,
        },
        { onConflict: "live_session_id,student_id" },
      )
      .select("id");
    check(
      "the database refuses a teacher marking a class they do not teach",
      !!outsiderMark.error,
      "an unassigned teacher rewrote another class's register",
    );

    const { data: studentOneMark } = await admin
      .from("live_attendance_records")
      .select("status")
      .eq("id", markOne)
      .maybeSingle();
    check(
      "the refused mark did not change anything",
      studentOneMark?.status === "present",
      "an unassigned teacher marked a pupil absent",
    );

    const studentMark = await asStudentOne
      .from("live_attendance_records")
      .upsert(
        {
          school_id: schoolId,
          live_session_id: announced,
          student_id: studentOne,
          status: "absent",
          marked_by: studentOneUser,
        },
        { onConflict: "live_session_id,student_id" },
      )
      .select("id");
    check(
      "the database refuses a pupil marking themselves",
      !!studentMark.error,
      "a pupil set their own attendance",
    );

    // --- deleting a session takes its register with it --------------------
    console.log("\nSessions: deletion");
    const outsiderDelete = await asOutsider
      .from("live_sessions")
      .delete()
      .eq("id", draft)
      .eq("school_id", schoolId);
    check("an unassigned teacher cannot delete a session", !outsiderDelete.error);
    const { data: draftAfterDelete } = await admin
      .from("live_sessions")
      .select("id")
      .eq("id", draft);
    check(
      "the session the outsider tried to delete is still there",
      countRows({ data: draftAfterDelete }) === 1,
    );

    const adminDelete = await asAdmin
      .from("live_sessions")
      .delete()
      .eq("id", draft)
      .eq("school_id", schoolId);
    check("a manager can delete a session", !adminDelete.error, adminDelete.error?.message);
    const { data: draftGone } = await admin.from("live_sessions").select("id").eq("id", draft);
    check("the session really is gone", countRows({ data: draftGone }) === 0);

    // --- the helper itself ------------------------------------------------
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
  } catch (err) {
    failed++;
    console.log(`  FAIL  harness error: ${err?.message ?? err}`);
    if (err?.stack) console.log(err.stack);
  } finally {
    // Sessions, marks and students cascade from the school, so deleting the
    // school is enough; only the users need clearing first, because auth.users is
    // not owned by the school.
    for (const userId of made.users) {
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("teacher_classes").delete().eq("teacher_id", userId);
      await admin.from("teachers").delete().eq("user_id", userId);
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
    }

    // Checked rather than assumed. A harness that ignores the result of its own
    // cleanup leaves a school and its sessions behind every time the network
    // hiccups, and the next run then counts rows it did not create.
    const leftovers = [];
    for (const schoolId of made.schools) {
      const { error } = await admin.from("schools").delete().eq("id", schoolId);
      if (error) leftovers.push(`${schoolId} (${error.code}: ${error.message})`);
    }
    const { data: stragglers } = await admin
      .from("schools")
      .select("slug")
      .like("slug", "live-rls-%");
    if (stragglers?.length) {
      leftovers.push(`unremoved: ${stragglers.map((s) => s.slug).join(", ")}`);
    }
    if (leftovers.length) {
      console.log(`  WARN  cleanup left rows behind -> ${leftovers.join("; ")}`);
    }

    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
  }
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});