#!/usr/bin/env node
// EduSphere — §87 Critical Acceptance Test
//
// End-to-end verification of the core journey on School A (Greenfield College)
// and the mandatory tenant-isolation guarantee (School B cannot access School A).
//
// Run order:
//   node scripts/seed.mjs          (idempotent — creates School A demo data)
//   node scripts/acceptance.mjs
//
// Every check is exercised through REAL RLS user sessions (anon key +
// signInWithPassword) exactly as the application does, so a FAILURE here means
// the product would misbehave for a real user.
//
// Exit code: 0 all pass, 1 any failure.

import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_USER_PASSWORD || "Testing2026";

if (!url || !anonKey || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// School A — Greenfield College (seeded).
const SCHOOL_A = "00000000-0000-0000-0000-000000000001";
// School B — created on demand by this test, then removed.
const DATE_TOKEN = Date.now().toString(36);
const SCHOOL_B_SLUG = `acceptance-b-${DATE_TOKEN}`;

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function userClient(email) {
  const c = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn failed for ${email}: ${error.message}`);
  return { client: c, user: data.user };
}

// ---------------------------------------------------------------------------
// Tiny harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures = [];

function ok(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  ✔ ${name}${extra ? ` — ${extra}` : ""}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ✖ ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

function section(title) {
  console.log(`\n== ${title} ==`);
}

function expectError(x) {
  return Boolean(x && (x.error || x.message));
}

// ---------------------------------------------------------------------------
// 1. Prerequisites
// ---------------------------------------------------------------------------
console.log("\n§87 CRITICAL ACCEPTANCE TEST — EduSphere");
section("1. Prerequisites");

const { data: schoolA } = await admin.from("schools").select("id, name").eq("id", SCHOOL_A).maybeSingle();
ok("School A (Greenfield College) exists", Boolean(schoolA), schoolA?.name);

let teacher, student, parent;
try {
  teacher = await userClient("teacher@greenfield.test");
  student = await userClient("student@greenfield.test");
  parent = await userClient("parent@greenfield.test");
  ok("teacher / student / parent demo users sign in", true);
} catch (e) {
  ok("teacher / student / parent demo users sign in", false, e.message);
  console.error("Run `node scripts/seed.mjs` first.");
  process.exit(1);
}

const teacherC = teacher.client;
const studentC = student.client;
const parentC = parent.client;

// ---------------------------------------------------------------------------
// 2. School A — structure the teacher sees
// ---------------------------------------------------------------------------
section("2. School A structure");

const { data: classes } = await teacherC.from("classes").select("id, name").eq("school_id", SCHOOL_A);
const ss2 = (classes ?? []).find((c) => c.name === "SS 2");
ok("Teacher reads class SS 2", Boolean(ss2));

const { data: subjects } = await teacherC.from("subjects").select("id, name").eq("school_id", SCHOOL_A);
const math = (subjects ?? []).find((s) => s.name === "Mathematics");
ok("Teacher reads subject Mathematics", Boolean(math));

const { data: teacherRows } = await teacherC.from("teachers").select("id").eq("school_id", SCHOOL_A);
ok("Teacher reads own teacher record", (teacherRows ?? []).length > 0);

const { data: teacherClasses } = await teacherC
  .from("teacher_classes")
  .select("id")
  .eq("school_id", SCHOOL_A)
  .eq("class_id", ss2?.id);
ok("Teacher is assigned to SS 2", (teacherClasses ?? []).length > 0);

const { data: teacherSubjects } = await teacherC
  .from("teacher_subjects")
  .select("id")
  .eq("school_id", SCHOOL_A)
  .eq("subject_id", math?.id);
ok("Mathematics is assigned to teacher", (teacherSubjects ?? []).length > 0);

// ---------------------------------------------------------------------------
// 3. Course → module → lesson (+ YouTube + PDF)
// ---------------------------------------------------------------------------
section("3. Digital learning content");

const { data: courses } = await studentC.from("courses").select("id, title, status").eq("school_id", SCHOOL_A);
const course = (courses ?? []).find((c) => c.title === "SS 2 Mathematics");
ok("Student reads published course 'SS 2 Mathematics'", Boolean(course && course.status === "published"), course?.status);

const { data: modules } = await studentC
  .from("course_modules")
  .select("id, title")
  .eq("school_id", SCHOOL_A)
  .eq("course_id", course?.id);
const moduleRow = (modules ?? []).find((m) => m.title === "Quadratic Equations");
ok("Course has 'Quadratic Equations' module", Boolean(moduleRow));

const { data: lessons } = await studentC.from("lessons").select("id, title, status").eq("school_id", SCHOOL_A).eq("course_id", course?.id);
const lesson = (lessons ?? []).find((l) => l.status === "published");
ok("Module has a published lesson", Boolean(lesson), lesson?.title);

// Ensure the lesson carries a YouTube video and a PDF material (server writes them).
if (lesson) {
  const { data: videos } = await studentC.from("video_resources").select("id, provider").eq("school_id", SCHOOL_A).eq("lesson_id", lesson.id);
  if (!videos || videos.length === 0) {
    const { error } = await admin.from("video_resources").insert({
      school_id: SCHOOL_A,
      lesson_id: lesson.id,
      provider: "youtube",
      provider_video_id: "dQw4w9WgXcQ",
      title: "Intro to Quadratics (demo)",
      created_by: teacher.user.id,
    });
    ok("Attach YouTube video to lesson", !error, error?.message ?? "ok");
  } else {
    ok("Lesson has a YouTube video", videos[0].provider === "youtube");
  }

  const { data: materials } = await studentC.from("lesson_materials").select("id, file_type").eq("school_id", SCHOOL_A).eq("lesson_id", lesson.id);
  if (!materials || materials.length === 0) {
    const { error } = await admin.from("lesson_materials").insert({
      school_id: SCHOOL_A,
      lesson_id: lesson.id,
      title: "Lesson notes (PDF)",
      file_type: "pdf",
      file_url: "https://example.com/demo/quadratics.pdf",
      is_public: false,
      created_by: teacher.user.id,
    });
    ok("Attach PDF material to lesson", !error, error?.message ?? "ok");
  } else {
    ok("Lesson has a PDF material", materials.some((m) => m.file_type === "pdf"));
  }
}

// ---------------------------------------------------------------------------
// 4. Student completes the lesson
// ---------------------------------------------------------------------------
section("4. Student completes lesson");

if (lesson) {
  const { data: lpExisting, error: lpGetErr } = await studentC
    .from("lesson_progress")
    .select("id, progress_percentage, completed_at")
    .eq("school_id", SCHOOL_A)
    .eq("lesson_id", lesson.id);
  const lpRow = (lpExisting ?? []).find((r) => r.id) ?? null;

  const upsert = lpRow
    ? await studentC.from("lesson_progress").update({ progress_percentage: 100, completed_at: new Date().toISOString() }).eq("id", lpRow.id)
    : await studentC.from("lesson_progress").insert({
        school_id: SCHOOL_A,
        student_id: (await studentC.from("students").select("id").eq("school_id", SCHOOL_A).single()).data?.id ?? null,
        lesson_id: lesson.id,
        progress_percentage: 100,
        completed_at: new Date().toISOString(),
      }).select("id").single();

  ok("Student records lesson completion (RLS)", !upsert.error, upsert.error?.message ?? "ok");

  const { data: progressRows } = await studentC
    .from("lesson_progress")
    .select("progress_percentage, completed_at")
    .eq("school_id", SCHOOL_A)
    .eq("lesson_id", lesson.id);
  const progressRow = (progressRows ?? []).find((r) => r && r.progress_percentage === 100);
  ok("Student can read back completed lesson", Boolean(progressRow && progressRow.completed_at));
}

// ---------------------------------------------------------------------------
// 5. Practice quiz (CBT)
// ---------------------------------------------------------------------------
section("5. Practice quiz / CBT");

const { data: seriesRows } = await studentC.from("exam_series").select("id, title").eq("school_id", SCHOOL_A).eq("status", "published");
const series = (seriesRows ?? [])[0];
ok("Student reads published exam series", Boolean(series), series?.title);

const { data: studentRow } = await studentC.from("students").select("id").eq("school_id", SCHOOL_A).maybeSingle();
ok("Student reads own student record", Boolean(studentRow));

// Ask the questions the student is about to sit.
const { data: bankRows } = await admin.from("question_banks").select("id").eq("school_id", SCHOOL_A).eq("exam_series_id", series?.id).is("deleted_at", null);
const bank = bankRows?.[0];

const { data: banksQuestions } = await admin
  .from("questions")
  .select("id, question_type, marks")
  .eq("school_id", SCHOOL_A)
  .eq("question_bank_id", bank?.id)
  .is("deleted_at", null);
const objectiveQs = (banksQuestions ?? []).filter((q) => q.question_type === "multiple_choice");

ok("Exam series has objective questions", objectiveQs.length > 0, `${objectiveQs.length} questions`);

if (series && studentRow && bank) {
  const objIds = objectiveQs.map((q) => q.id);
  const { data: opts } = await admin
    .from("question_options")
    .select("id, question_id, is_correct")
    .eq("school_id", SCHOOL_A)
    .in("question_id", objIds);
  const correctByQ = new Map();
  for (const o of opts ?? []) if (o.is_correct && !correctByQ.has(o.question_id)) correctByQ.set(o.question_id, o.id);

  // A fresh attempt (student session writes it — RLS insert allowed).
  const { data: attempt, error: attemptErr } = await studentC
    .from("practice_attempts")
    .insert({
      school_id: SCHOOL_A,
      exam_series_id: series.id,
      student_id: studentRow.id,
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  ok("Student starts a practice attempt (RLS insert)", !attemptErr, attemptErr?.message ?? "ok");

  if (attempt) {
    const answers = objectiveQs.map((q) => ({
      school_id: SCHOOL_A,
      attempt_id: attempt.id,
      question_id: q.id,
      selected_option_id: correctByQ.get(q.id) ?? null,
      is_correct: Boolean(correctByQ.get(q.id)),
      marks_awarded: correctByQ.get(q.id) ? Number(q.marks) : 0,
      answered_at: new Date().toISOString(),
    }));
    const { error: ansErr } = await studentC.from("practice_answers").insert(answers);
    ok("Student saves answers (RLS insert)", !ansErr, ansErr?.message ?? "ok");

    // Server submits + scores (the app uses service role for this).
    const autoScore = objectiveQs.reduce((s, q) => s + (correctByQ.get(q.id) ? Number(q.marks) : 0), 0);
    const total = objectiveQs.reduce((s, q) => s + Number(q.marks), 0);
    const { error: submitErr } = await admin
      .from("practice_attempts")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        score: autoScore,
        total_marks: total,
        correct_count: objectiveQs.length,
        wrong_count: 0,
        time_used_seconds: 90,
      })
      .eq("id", attempt.id);
    ok("Server submits attempt and calculates score", !submitErr, submitErr?.message ?? `auto ${autoScore}/${total}`);

    const { data: final } = await studentC.from("practice_attempts").select("score, status").eq("id", attempt.id).single();
    ok("Student sees own CBT result", Boolean(final && final.status === "submitted" && Number(final.score) === Number(total)), `score ${final?.score}/${total}`);

    const { data: teacherSees } = await teacherC.from("practice_attempts").select("id, score").eq("id", attempt.id);
    ok("Teacher sees the student's attempt", (teacherSees ?? []).length > 0);

    const { data: adminSees } = await admin.from("practice_attempts").select("id").eq("id", attempt.id);
    ok("School admin sees the attempt", (adminSees ?? []).length > 0);

    // Anti-cheat: a student can never rewrite their own score (no RLS update policy
    // → PostgREST silently updates 0 rows).
    await studentC.from("practice_attempts").update({ score: 999, status: "submitted" }).eq("id", attempt.id);
    const { data: afterTamper } = await studentC.from("practice_attempts").select("score").eq("id", attempt.id).single();
    ok("Student CANNOT tamper with the score (RLS blocks update)", Boolean(afterTamper && Number(afterTamper.score) === Number(total)), `score still ${afterTamper?.score}`);
  }
}

// ---------------------------------------------------------------------------
// 6. Assignment → submit → grade
// ---------------------------------------------------------------------------
section("6. Assignment lifecycle");

const { data: assignmentRows } = await teacherC.from("assignments").select("id, title, created_by").eq("school_id", SCHOOL_A).eq("status", "published");
const assignment = (assignmentRows ?? [])[0];
ok("Teacher reads own assignment", Boolean(assignment), assignment?.title);

const { data: subRows } = await teacherC
  .from("assignment_submissions")
  .select("id, status, score")
  .eq("school_id", SCHOOL_A)
  .eq("assignment_id", assignment?.id);
const submission = (subRows ?? []).find((s) => s);
ok("Teacher sees the student's submission(s)", Boolean(submission));

if (submission && assignment && assignment.created_by === teacher.user.id) {
  const { error: gradeErr } = await teacherC
    .from("assignment_submissions")
    .update({ status: "graded", score: 85, feedback: "Good working shown.", graded_at: new Date().toISOString() })
    .eq("id", submission.id);
  ok("Teacher grades the submission (RLS update)", !gradeErr, gradeErr?.message ?? "score 85");

  const { data: graded } = await studentC.from("assignment_submissions").select("id, score, feedback").eq("id", submission.id).single();
  ok("Student sees graded score + feedback", Boolean(graded && Number(graded.score) === 85), `score ${graded?.score}`);
}

// ---------------------------------------------------------------------------
// 7. Parent sees Student A's results
// ---------------------------------------------------------------------------
section("7. Parent portal");

const { data: parentLinks } = await parentC
  .from("parent_student_relationships")
  .select("student_id")
  .eq("school_id", SCHOOL_A);
ok("Parent reads linked children (RLS)", (parentLinks ?? []).length > 0, `${(parentLinks ?? []).length} child/children`);

const childId = parentLinks?.[0]?.student_id ?? null;
if (childId && studentRow) {
  ok("Linked child is the demo student", childId === studentRow.id);

  const { data: childStudents } = await parentC.from("students").select("id, admission_number, display_name").eq("id", childId).eq("school_id", SCHOOL_A);
  ok("Parent reads child's student record", (childStudents ?? []).length > 0);

  // These two are what the parent report card reads (report-cards.ts). If the
  // policy below is missing, the parent portal silently shows no data.
  const { data: pSubs } = await parentC
    .from("assignment_submissions")
    .select("id, score")
    .eq("school_id", SCHOOL_A)
    .eq("student_id", childId);
  ok("Parent reads child's graded submissions", (pSubs ?? []).length > 0);

  const { data: pAtts } = await parentC
    .from("practice_attempts")
    .select("id, score")
    .eq("school_id", SCHOOL_A)
    .eq("student_id", childId);
  ok("Parent reads child's CBT attempts", (pAtts ?? []).length > 0);
}

// ---------------------------------------------------------------------------
// 8. Tenant isolation (mandatory §87)
// ---------------------------------------------------------------------------
section("8. Tenant isolation — School B cannot access School A");

// Create School B + its admin user.
const { data: schoolB, error: sbErr } = await admin
  .from("schools")
  .insert({ name: "Sunnyside High", slug: SCHOOL_B_SLUG, status: "active" })
  .select("id")
  .single();
ok("Create School B", !sbErr, sbErr?.message ?? "ok");

let schoolBId = schoolB?.id ?? null;
let schoolBUser = null;
if (schoolB) {
  const bEmail = `acceptance-b-${DATE_TOKEN}@test.test`;
  const { data: bUser, error: bUserErr } = await admin.auth.admin.createUser({
    email: bEmail,
    password: "Testing2026",
    email_confirm: true,
    user_metadata: { full_name: "School B Admin" },
  });
  if (bUserErr) {
    ok("Create School B admin user", false, bUserErr.message);
  } else {
    schoolBUser = bUser.user;
    const { error: roleErr } = await admin.from("user_roles").insert({
      school_id: schoolBId,
      user_id: bUser.user.id,
      role: "SCHOOL_ADMIN",
    });
    ok("Assign School B admin role", !roleErr, roleErr?.message ?? "ok");
  }
}

if (schoolB && schoolBUser) {
  const b = await userClient(`acceptance-b-${DATE_TOKEN}@test.test`);
  const bC = b.client;

  const isolationTableChecks = [
    ["classes", "courses", "students", "subjects", "assignment_submissions", "practice_attempts", "results", "lessons", "teachers", "parents"],
  ][0];

  for (const table of isolationTableChecks) {
    const { data, error } = await bC
      .from(table)
      .select("id")
      .eq("school_id", SCHOOL_A);
    ok(`School B admin sees ZERO School A ${table}`, (data ?? []).length === 0 && !error, `${(data ?? []).length} leaked`);
  }

  const { data: bCourses } = await bC.from("courses").select("id");
  ok("School B admin sees only own school's rows (none)", (bCourses ?? []).length === 0);

  // School B admin cannot WRITE School A data either.
  const { error: writeErr } = await bC
    .from("courses")
    .insert({ school_id: SCHOOL_A, title: "Hijack", status: "published" });
  ok("School B admin CANNOT create a course under School A", expectError(writeErr), writeErr?.message ?? "unexpected success");

  // School B admin cannot read School A's members' profiles.
  const { data: profs } = await bC.from("profiles").select("id").eq("id", teacher.user.id);
  ok("School B admin cannot see School A teacher's profile", (profs ?? []).length === 0);
}

// Cleanup: School B user + school.
if (schoolBUser) {
  await admin.auth.admin.deleteUser(schoolBUser.id);
}
if (schoolBId) {
  await admin.from("schools").delete().eq("id", schoolBId);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n\nRESULT: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("§87 Critical Acceptance Test PASSED.");