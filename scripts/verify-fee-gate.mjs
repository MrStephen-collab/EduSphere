// Proves the fee gate actually withholds course materials, rather than only
// existing as a column and a service function.
//
// The gap this answers: a fee gate is easy to write as a disabled setting and a
// helper nobody calls. This signs in as the seeded admin and student and checks
// the two things that matter end to end --
//
//   1. the setting is reachable and changes what a real lesson page renders;
//   2. a material a gated student must not open is genuinely not rendered to
//      them, while the lesson, its notes and its progress still are.
//
// The negative assertion is the whole point. A gate that dims a button but leaves
// the signed URL in the HTML has not gated anything, so the check looks for the
// material titles and their viewer controls being absent, not for a warning
// banner being present.
//
// Every mutation is restored in the finally block, including the school's own
// threshold, so running this against a live database cannot leave a school with
// its materials held.
//
// Run with: npm run build && npm run app, then: npm run verify:fee-gate
//
// 0027 must be applied first. If the first check fails, run
// `npx supabase db push --include-all` (or paste the migration into the Supabase
// SQL editor).

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import dotenv from "dotenv";
import { installHttp1Fetch } from "./lib/http1-fetch.mjs";

dotenv.config({ path: ".env.local", quiet: true });
installHttp1Fetch();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_USER_PASSWORD || "Testing2026";
const BASE = (process.env.BASE || "http://localhost:3100").replace(/\/$/, "");

function createSession() {
  const jar = new Map();
  return {
    jar,
    header: () => [...jar].map(([n, v]) => `${n}=${v}`).join("; "),
    absorb(res) {
      for (const raw of res.headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(";");
        const eq = pair.indexOf("=");
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        if (value === "") jar.delete(name);
        else jar.set(name, value);
      }
    },
  };
}

async function signIn(email) {
  const session = createSession();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [...session.jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const c of cookies) session.jar.set(c.name, c.value);
      },
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email}: ${error.message}`);
  return session;
}

// Redirects are not followed: a sign-in that bounced to /auth/login comes back as
// a healthy 200 carrying the login page, which would turn every later assertion
// into a quiet failure for the wrong reason.
async function get(email, path) {
  const session = await signIn(email);
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: session.header() },
    redirect: "manual",
  });
  session.absorb(res);
  return {
    status: res.statusCode ?? res.status,
    location: res.headers.get("location"),
    html: await res.text(),
  };
}

let pass = 0;
let fail = 0;
function check(name, ok, detail) {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

/** The seeded student, found by email rather than by a hardcoded id. */
async function studentSchoolId() {
  const session = await signIn("student@greenfield.test");
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [...session.jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const c of cookies) session.jar.set(c.name, c.value);
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("the student account could not sign in");
  const { data: student, error } = await admin
    .from("students")
    .select("id, class_id, school_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!student) throw new Error("the student account has no student row -- run `node scripts/seed.mjs`");
  return student;
}

const run = async () => {
  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const student = await studentSchoolId();
  const schoolId = student.school_id;
  const { data: school, error: schoolError } = await admin
    .from("schools")
    .select("id, name, learning_access_threshold_pct")
    .eq("id", schoolId)
    .maybeSingle();

  // The missing-column case is reported rather than thrown, because a PostgREST
  // error for an unapplied migration looks like a broken script rather than a
  // step that has not been taken yet, and the fix is one paste into the SQL
  // editor. Checked before anything else so it is the only thing that runs.
  if (schoolError?.message?.includes("learning_access_threshold_pct")) {
    check("0027 is applied: schools.learning_access_threshold_pct exists", false,
      "column missing -- apply supabase/migrations/0027_learning_access_threshold.sql, then re-run");
    report();
    return;
  }
  if (schoolError) throw new Error(schoolError.message);
  if (!school) throw new Error("the student's school row is missing -- run `node scripts/seed.mjs`");

  const originalThreshold = school.learning_access_threshold_pct;
  console.log(`\nTarget: ${BASE}\nSchool: ${school.name}\nStudent class: ${student.class_id}\n`);

  if (originalThreshold === undefined || originalThreshold === null) {
    check(
      "0027 is applied: schools.learning_access_threshold_pct exists",
      false,
      "the column read back as null rather than a default of 0",
    );
    report();
    return;
  }
  check("0027 is applied: schools.learning_access_threshold_pct exists", true);
  check(
    "the gate defaults to off for a school that never set one",
    originalThreshold === 0,
    `expected 0, found ${originalThreshold}`,
  );

  // The constraint is what stops a form value like 150 from becoming a rule that
  // can never be met, which would silently lock every student out forever.
  const { error: overError } = await admin
    .from("schools")
    .update({ learning_access_threshold_pct: 101 })
    .eq("id", schoolId);
  check("the database refuses a threshold above 100", !!overError, overError ? "" : "101 was accepted");
  const { error: underError } = await admin
    .from("schools")
    .update({ learning_access_threshold_pct: -1 })
    .eq("id", schoolId);
  check("the database refuses a negative threshold", !!underError, underError ? "" : "-1 was accepted");

  const setThreshold = async (pct) => {
    const { error } = await admin
      .from("schools")
      .update({ learning_access_threshold_pct: pct })
      .eq("id", schoolId);
    if (error) throw new Error(error.message);
  };

  // A published lesson in this student's class, with a material attached, so the
  // page under test is one the student can actually reach.
  const { data: lesson, error: lessonError } = await admin
    .from("lessons")
    .select("id, course_id, title, status")
    .eq("school_id", schoolId)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lessonError) throw new Error(lessonError.message);
  if (!lesson) {
    check("a published lesson exists to test against", false, "run `node scripts/seed.mjs`");
    report();
    return;
  }

  const { data: materials } = await admin
    .from("lesson_materials")
    .select("id, title")
    .eq("lesson_id", lesson.id)
    .is("deleted_at", null);

  const { data: course } = await admin
    .from("courses")
    .select("id, title, status")
    .eq("id", lesson.course_id)
    .single();

  const lessonPath = `/student/courses/${lesson.course_id}/lessons/${lesson.id}`;
  const materialTitle = materials?.[0]?.title ?? null;
  console.log(`Lesson: ${lesson.title}\nCourse: ${course?.title}\nPath: ${lessonPath}\n`);

  try {
    // ---- The gate off: everything renders. -------------------------------
    await setThreshold(0);
    const open = await get("student@greenfield.test", lessonPath);
    check(
      "with the gate off the lesson page renders",
      open.status === 200 && !open.location,
      open.location ? `redirected to ${open.location}` : `status ${open.status}`,
    );
    check(
      "with the gate off no fee notice is shown at all",
      !open.html.includes("before materials open") && !open.html.includes("materials are open to you"),
      "a school that has not set a threshold is still showing gate UI",
    );
    if (materialTitle) {
      check(
        "with the gate off the material is listed",
        open.html.includes(materialTitle),
        `material "${materialTitle}" missing from the page`,
      );
    }

    // ---- The gate on, the student short. ----------------------------------
    await setThreshold(100);
    const locked = await get("student@greenfield.test", lessonPath);
    check(
      "with the gate on the lesson still renders",
      locked.status === 200 && !locked.location,
      locked.location ? `redirected to ${locked.location}` : `status ${locked.status}`,
    );
    check(
      "the student is told the threshold they have to reach",
      locked.html.includes("before materials open"),
      "no explanation of the gate on the lesson page",
    );
    check(
      "the shortfall is stated, not just the requirement",
      locked.html.includes("You have paid"),
      "a student is told a threshold without being told what they still owe",
    );
    check(
      "the notice links to the fees page",
      locked.html.includes("/student/fees"),
      "a blocked student is not sent anywhere to pay",
    );

    // The lesson itself must survive: only materials are held.
    check(
      "the lesson is still readable while materials are held",
      locked.html.includes(lesson.title),
      "the gate took the whole lesson away, not just its materials",
    );

    if (materialTitle) {
      check(
        "the held material is not rendered to the student",
        !locked.html.includes(materialTitle),
        `material "${materialTitle}" is still in the HTML of a gated lesson`,
      );
      check(
        "no material viewer control is rendered while gated",
        !locked.html.includes(`aria-label="${materialTitle}"`),
        "the viewer button is still in the HTML, so it is still clickable",
      );
    }

    // ---- The other student-facing surfaces. -------------------------------
    const courses = await get("student@greenfield.test", "/student/courses");
    check(
      "the courses list carries the gate notice",
      courses.html.includes("before materials open"),
      "a student finds out only after opening a lesson",
    );

    const fees = await get("student@greenfield.test", "/student/fees");
    check(
      "the fees page explains what is holding the materials",
      fees.html.includes("before materials open"),
      "the page that takes the payment does not mention the gate",
    );

    // ---- The admin side is reachable. -------------------------------------
    const adminFees = await get("admin@greenfield.test", "/school/fees");
    check(
      "the gate control is on the fees page an admin already visits",
      adminFees.html.includes("Percentage of fees to pay before materials open"),
      "no gate control on /school/fees",
    );
    check(
      "the current threshold is shown to the admin",
      adminFees.html.includes('value="100"'),
      "the control did not render the school's current setting",
    );
    check(
      "the admin is told a waiver is how a student is exempted",
      adminFees.html.includes("waive their invoice"),
      "no guidance on exempting a student, so a bursar may build a shadow list",
    );

    // ---- A gate the student has already met is not a block. ---------------
    // Set the threshold to the share they have actually paid, so this exercises
    // the "cleared" branch of the same rendering path rather than trusting it.
    const { data: invoices } = await admin
      .from("fee_invoices")
      .select("amount, amount_paid, status")
      .eq("school_id", schoolId)
      .eq("student_id", student.id);
    const chargeable = (invoices ?? []).filter(
      (i) => i.status === "unpaid" || i.status === "partially_paid" || i.status === "paid",
    );
    const invoiced = chargeable.reduce((s, i) => s + Number(i.amount), 0);
    const paid = chargeable.reduce((s, i) => s + Number(i.amount_paid), 0);
    const paidPct = invoiced > 0 ? Math.floor((paid / invoiced) * 100) : 100;
    console.log(
      `Student standing: invoiced ${invoiced}, paid ${paid} (${paidPct}%)\n`,
    );

    await setThreshold(paidPct);
    const cleared = await get("student@greenfield.test", lessonPath);
    check(
      "a student who has reached the threshold is not blocked",
      !cleared.html.includes("before materials open"),
      `at ${paidPct}% paid with a ${paidPct}% gate the page still says materials are held`,
    );
    check(
      "a student who has reached the threshold is told so",
      cleared.html.includes("materials are open to you"),
      "no confirmation, so a family paying in instalments cannot tell it landed",
    );
    if (materialTitle) {
      check(
        "the material opens once the threshold is met",
        cleared.html.includes(materialTitle),
        `material "${materialTitle}" still missing at ${paidPct}% paid`,
      );
    }

    // ---- The setting is per school, not global. ---------------------------
    const { data: otherSchools } = await admin
      .from("schools")
      .select("id")
      .neq("id", schoolId)
      .limit(1);
    if (otherSchools?.length) {
      const { data: other } = await admin
        .from("schools")
        .select("learning_access_threshold_pct")
        .eq("id", otherSchools[0].id)
        .single();
      check(
        "another school is not gated by this school's setting",
        (other?.learning_access_threshold_pct ?? 0) === 0,
        `an unrelated school reads ${other?.learning_access_threshold_pct}`,
      );
    }
  } finally {
    // Restored even if an assertion above threw: leaving a seeded school at 100%
    // would take every student's materials away until someone noticed.
    await admin
      .from("schools")
      .update({ learning_access_threshold_pct: originalThreshold })
      .eq("id", schoolId);
    console.log(`\nRestored ${school.name} threshold to ${originalThreshold}.`);
  }

  report();
};

function report() {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
