// Proves the teacher per-class weak-topic query (spec section 75) runs against
// the real database.
//
// The roll-up maths (accuracy per topic, weakest-first ordering, the minimum
// answer threshold) is pure and unit-tested in src/lib/teacher-topics.ts. What
// can only break against the live schema is the nested embed used by
// getTeacherAnalytics in src/services/analytics.ts:
//
//   examination_answers
//     → examination_questions(examination_id, questions(topic))
//
// plus the examinations(id, class_id) lookup that turns an answer into a class.
// This harness seeds one answered examination and runs those exact shapes.
//
// Run with: node scripts/verify-teacher-topics.mjs
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
      .insert({ name: `Topics School ${stamp}`, slug: `topics-school-${stamp}` })
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
        admission_number: `TOPIC-${stamp}`,
        class_id: klass.id,
        display_name: "Topic Student",
      })
      .select("id")
      .single();
    if (studentError || !student) throw new Error(`student: ${studentError?.message}`);

    const { data: question, error: questionError } = await admin
      .from("questions")
      .insert({
        school_id: schoolId,
        subject_id: subject.id,
        class_id: klass.id,
        question_text: "What is 1/2 + 1/2?",
        topic: "Fractions",
      })
      .select("id")
      .single();
    if (questionError || !question) throw new Error(`question: ${questionError?.message}`);

    const { data: exam, error: examError } = await admin
      .from("examinations")
      .insert({
        school_id: schoolId,
        class_id: klass.id,
        subject_id: subject.id,
        title: "Topics Examination",
        status: "published",
      })
      .select("id")
      .single();
    if (examError || !exam) throw new Error(`examination: ${examError?.message}`);

    const { data: examQuestion, error: eqError } = await admin
      .from("examination_questions")
      .insert({
        school_id: schoolId,
        examination_id: exam.id,
        question_id: question.id,
        marks: 1,
      })
      .select("id")
      .single();
    if (eqError || !examQuestion) throw new Error(`examination_question: ${eqError?.message}`);

    const { data: attempt, error: attemptError } = await admin
      .from("examination_attempts")
      .insert({
        school_id: schoolId,
        examination_id: exam.id,
        student_id: student.id,
        status: "submitted",
      })
      .select("id")
      .single();
    if (attemptError || !attempt) throw new Error(`attempt: ${attemptError?.message}`);

    const { error: answerError } = await admin.from("examination_answers").insert({
      school_id: schoolId,
      attempt_id: attempt.id,
      examination_question_id: examQuestion.id,
      is_correct: false,
    });
    if (answerError) throw new Error(`answer: ${answerError.message}`);

    // --- the topic embed --------------------------------------------------
    console.log("\nTopic roll-up: answers carry their topic and exam id");
    const answers = await admin
      .from("examination_answers")
      .select("is_correct, examination_questions(examination_id, questions(topic))")
      .eq("school_id", schoolId)
      .not("is_correct", "is", null)
      .limit(2000);

    const row = (answers.data ?? [])[0];
    const embed = Array.isArray(row?.examination_questions)
      ? row.examination_questions[0]
      : row?.examination_questions;
    const nested = embed && (Array.isArray(embed.questions) ? embed.questions[0] : embed.questions);
    check(
      "an answered question resolves through to its topic and examination",
      !answers.error && nested?.topic === "Fractions" && embed?.examination_id === exam.id,
      answers.error?.message ?? JSON.stringify(row),
    );

    // --- examinations class lookup ----------------------------------------
    console.log("\nClass lookup: the examination's class resolves");
    const schoolsExam = await admin
      .from("examinations")
      .select("id, class_id")
      .eq("school_id", schoolId)
      .is("deleted_at", null);
    const examRow = schoolsExam.data?.find((e) => e.id === exam.id);
    check(
      "the examination maps to its class, so answers can be grouped per class",
      !schoolsExam.error && examRow?.class_id === klass.id,
      schoolsExam.error?.message ?? JSON.stringify(schoolsExam.data),
    );
  } catch (err) {
    failed++;
    console.log(`  FAIL  harness error: ${err?.message ?? err}`);
    if (err?.stack) console.log(err.stack);
  } finally {
    for (const school of made.schools) {
      await admin.from("examination_answers").delete().eq("school_id", school);
      await admin.from("examination_attempts").delete().eq("school_id", school);
      await admin.from("examination_questions").delete().eq("school_id", school);
      await admin.from("examinations").delete().eq("school_id", school);
      await admin.from("questions").delete().eq("school_id", school);
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
