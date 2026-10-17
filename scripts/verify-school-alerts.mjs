// Proves the school dashboard alert queries (spec section 34) run against the
// real database.
//
// The alert *judgements* are pure and unit-tested in src/lib/school-alerts.ts.
// What can only break against the live schema is the querying in
// src/services/school-alerts.ts, and in particular the nested joins:
//   * assignment_submissions → assignments → classes (for the class a pending
//     submission belongs to), and
//   * examinations → classes.
// This harness seeds a small school and runs those exact shapes (as the
// service-role client the service uses, after its admin check), plus the date
// filter that narrows results by created_at.
//
// Run with: node scripts/verify-school-alerts.mjs
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

if (!URL || !SERVICE) {
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

const run = async () => {
  const stamp = Date.now();
  const made = { schools: [] };

  try {
    // --- fixtures ---------------------------------------------------------
    const { data: school, error: schoolError } = await admin
      .from("schools")
      .insert({ name: `Alert School ${stamp}`, slug: `alert-school-${stamp}` })
      .select("id")
      .single();
    if (schoolError || !school) throw new Error(`school: ${schoolError?.message}`);
    made.schools.push(school.id);
    const schoolId = school.id;

    const { data: klass, error: classError } = await admin
      .from("classes")
      .insert({ school_id: schoolId, name: "JSS 1" })
      .select("id")
      .single();
    if (classError || !klass) throw new Error(`class: ${classError?.message}`);

    const { data: subject, error: subjectError } = await admin
      .from("subjects")
      .insert({ school_id: schoolId, name: "Mathematics" })
      .select("id")
      .single();
    if (subjectError || !subject) throw new Error(`subject: ${subjectError?.message}`);

    const { data: student, error: studentError } = await admin
      .from("students")
      .insert({
        school_id: schoolId,
        admission_number: `ALERT-${stamp}`,
        class_id: klass.id,
        display_name: "Alert Student",
      })
      .select("id")
      .single();
    if (studentError || !student) throw new Error(`student: ${studentError?.message}`);

    const { data: assignment, error: assignmentError } = await admin
      .from("assignments")
      .insert({
        school_id: schoolId,
        class_id: klass.id,
        subject_id: subject.id,
        title: "Alert Assignment",
        due_date: new Date(stamp - 3 * 86_400_000).toISOString(),
      })
      .select("id")
      .single();
    if (assignmentError || !assignment) throw new Error(`assignment: ${assignmentError?.message}`);

    const { error: submissionError } = await admin.from("assignment_submissions").insert({
      school_id: schoolId,
      assignment_id: assignment.id,
      student_id: student.id,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    });
    if (submissionError) throw new Error(`submission: ${submissionError.message}`);

    const { data: examination, error: examError } = await admin
      .from("examinations")
      .insert({
        school_id: schoolId,
        class_id: klass.id,
        subject_id: subject.id,
        title: "Alert Examination",
        status: "published",
        starts_at: new Date(stamp + 5 * 86_400_000).toISOString(),
      })
      .select("id")
      .single();
    if (examError || !examination) throw new Error(`examination: ${examError?.message}`);

    const recentResultAt = new Date(stamp - 2 * 86_400_000).toISOString();
    const oldResultAt = new Date(stamp - 120 * 86_400_000).toISOString();
    const { error: resultsError } = await admin.from("results").insert([
      {
        school_id: schoolId,
        student_id: student.id,
        subject_id: subject.id,
        percentage: 40,
        pass: false,
        created_at: recentResultAt,
      },
      {
        school_id: schoolId,
        student_id: student.id,
        subject_id: subject.id,
        percentage: 80,
        pass: true,
        created_at: oldResultAt,
      },
    ]);
    if (resultsError) throw new Error(`results: ${resultsError.message}`);

    // --- pending assignments embed ---------------------------------------
    console.log("\nPending assignments: the nested class join resolves");
    const pending = await admin
      .from("assignment_submissions")
      .select("assignment_id, assignments(id, title, due_date, class_id, classes(name))")
      .eq("school_id", schoolId)
      .in("status", ["submitted", "late"])
      .limit(2000);
    const pendingRow = (pending.data ?? [])[0];
    const pendingAssignment = Array.isArray(pendingRow?.assignments)
      ? pendingRow.assignments[0]
      : pendingRow?.assignments;
    const pendingClass = Array.isArray(pendingAssignment?.classes)
      ? pendingAssignment.classes[0]
      : pendingAssignment?.classes;
    check(
      "a submission awaiting marking carries its assignment and class",
      !pending.error &&
        pendingAssignment?.title === "Alert Assignment" &&
        pendingClass?.name === "JSS 1",
      pending.error?.message ?? JSON.stringify(pendingRow),
    );

    // --- upcoming examinations embed -------------------------------------
    console.log("\nUpcoming examinations: the class join resolves");
    const now = new Date();
    const horizon = new Date(now.getTime() + 14 * 86_400_000);
    const upcoming = await admin
      .from("examinations")
      .select("id, title, starts_at, class_id, classes(name)")
      .eq("school_id", schoolId)
      .eq("status", "published")
      .gte("starts_at", now.toISOString())
      .lte("starts_at", horizon.toISOString())
      .order("starts_at", { ascending: true });
    const upcomingRow = (upcoming.data ?? [])[0];
    const upcomingClass = Array.isArray(upcomingRow?.classes)
      ? upcomingRow.classes[0]
      : upcomingRow?.classes;
    check(
      "a published examination within two weeks carries its class",
      !upcoming.error && upcomingRow?.title === "Alert Examination" && upcomingClass?.name === "JSS 1",
      upcoming.error?.message ?? JSON.stringify(upcomingRow),
    );

    // --- the results date filter -----------------------------------------
    console.log("\nResults: the date filter narrows by created_at");
    const windowFrom = new Date(now.getTime() - 30 * 86_400_000).toISOString();

    const recent = await admin
      .from("results")
      .select("percentage, created_at")
      .eq("school_id", schoolId)
      .not("percentage", "is", null)
      .gte("created_at", windowFrom)
      .order("created_at", { ascending: false })
      .limit(2000);
    check(
      "a 30-day window returns only the recent result",
      !recent.error && recent.data?.length === 1 && Number(recent.data[0].percentage) === 40,
      recent.error?.message ?? `got ${recent.data?.length} rows`,
    );

    const all = await admin
      .from("results")
      .select("percentage")
      .eq("school_id", schoolId)
      .not("percentage", "is", null)
      .limit(2000);
    check(
      "no window returns every result",
      !all.error && all.data?.length === 2,
      all.error?.message ?? `got ${all.data?.length} rows`,
    );
  } catch (err) {
    failed++;
    console.log(`  FAIL  harness error: ${err?.message ?? err}`);
    if (err?.stack) console.log(err.stack);
  } finally {
    for (const school of made.schools) {
      await admin.from("results").delete().eq("school_id", school);
      await admin.from("examinations").delete().eq("school_id", school);
      await admin.from("assignments").delete().eq("school_id", school);
      await admin.from("students").delete().eq("school_id", school);
      await admin.from("subjects").delete().eq("school_id", school);
      await admin.from("classes").delete().eq("school_id", school);
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
