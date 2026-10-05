// Proves the content-category rule holds in the database, not just in the picker.
//
// The complaint this answers was "a secondary school should not be able to label
// something a lecture or a thesis". The form already hides those options, but a
// form is a UI: a crafted request, a future script or another client can still
// write the value directly. This exercises the write path itself, through the
// service-role key, so it sees what the trigger does rather than what the
// dropdown offered.
//
// The expected taxonomy is restated here rather than imported, deliberately. A
// verifier that shares code with the thing it verifies proves only that the code
// agrees with itself, and src/lib/content-categories.ts cannot be loaded by Node
// anyway -- it is a bundler-resolved TypeScript module. This list is written from
// the specification in 0026_content_categories.sql, so the two are checked
// against each other by agreement rather than by construction.

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { installHttp1Fetch } from "./lib/http1-fetch.mjs";

dotenv.config({ path: ".env.local" });
installHttp1Fetch();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** What every school may use. */
const CORE = ["video", "slides", "audio", "pdf", "document", "image", "link"];
/** What only a college, polytechnic or university may use. */
const HIGHER_ED = ["lecture", "seminar", "lab", "project", "exam_prep"];
/** A value that must never be accepted, to prove the checks above can fail. */
const NOT_A_CATEGORY = "quiz";

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

function report() {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

const run = async () => {
  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  /**
   * Writes a value straight to content_type and reports whether the database
   * took it. Rejection is a valid outcome, so the caller asserts on it.
   */
  const write = async (table, id, schoolId, value) => {
    const { error } = await admin
      .from(table)
      .update({ content_type: value })
      .eq("id", id)
      .eq("school_id", schoolId);
    return { accepted: !error, message: error?.message ?? "" };
  };

  // Two schools of our own, so nothing here can disturb seeded data.
  const stamp = Date.now();
  const { data: secondary, error: secondaryError } = await admin
    .from("schools")
    .insert({
      name: `Category Probe Secondary ${stamp}`,
      slug: `category-probe-secondary-${stamp}`,
      education_level: "secondary",
    })
    .select("id")
    .single();
  if (secondaryError) throw new Error(`could not create a probe school: ${secondaryError.message}`);

  const { data: college, error: collegeError } = await admin
    .from("schools")
    .insert({
      name: `Category Probe College ${stamp}`,
      slug: `category-probe-college-${stamp}`,
      education_level: "college",
    })
    .select("id")
    .single();
  if (collegeError) throw new Error(`could not create a probe school: ${collegeError.message}`);

  try {
    const { data: course, error: courseError } = await admin
      .from("courses")
      .insert({
        school_id: secondary.id,
        title: "Category probe course",
        status: "draft",
        content_type: "video",
      })
      .select("id")
      .single();
    if (courseError) {
      throw new Error(
        `could not create a probe course: ${courseError.message}. ` +
          "If the column is missing, apply 0026 with `npx supabase db push --include-all`.",
      );
    }

    const { data: lesson, error: lessonError } = await admin
      .from("lessons")
      .insert({
        school_id: secondary.id,
        course_id: course.id,
        title: "Category probe lesson",
        status: "draft",
        content_type: "pdf",
      })
      .select("id")
      .single();
    if (lessonError) throw new Error(`could not create a probe lesson: ${lessonError.message}`);

    check("a course accepts a core category", true);
    check("a lesson accepts a core category", true);

    for (const category of CORE) {
      const result = await write("courses", course.id, secondary.id, category);
      check(`a secondary school may set a course to "${category}"`, result.accepted, result.message);
    }

    for (const category of HIGHER_ED) {
      const onCourse = await write("courses", course.id, secondary.id, category);
      check(
        `a secondary school is refused "${category}" on a course`,
        !onCourse.accepted && /higher-education/i.test(onCourse.message),
        onCourse.accepted ? "the database accepted it" : onCourse.message,
      );

      const onLesson = await write("lessons", lesson.id, secondary.id, category);
      check(
        `a secondary school is refused "${category}" on a lesson`,
        !onLesson.accepted && /higher-education/i.test(onLesson.message),
        onLesson.accepted ? "the database accepted it" : onLesson.message,
      );
    }

    // A label that is not a category at all has to be refused too, otherwise the
    // refusals above would prove nothing.
    const bogus = await write("courses", course.id, secondary.id, NOT_A_CATEGORY);
    check(
      `"${NOT_A_CATEGORY}" is refused as a content category`,
      !bogus.accepted,
      bogus.accepted ? "the database accepted it" : undefined,
    );

    // Null has to stay legal: existing courses and lessons predate categories
    // and must not be forced to adopt one.
    const { data: cleared, error: clearError } = await admin
      .from("lessons")
      .update({ content_type: null })
      .eq("id", lesson.id)
      .select("content_type")
      .single();
    check(
      "a category can be cleared back to uncategorised",
      !clearError && cleared?.content_type === null,
      clearError?.message ?? `read back ${JSON.stringify(cleared?.content_type)}`,
    );

    // The trigger has to reject the school, not the value: the same label is
    // fine once the school is one that may offer it.
    const { data: collegeCourse, error: collegeCourseError } = await admin
      .from("courses")
      .insert({
        school_id: college.id,
        title: "Category probe college course",
        status: "draft",
        content_type: "lecture",
      })
      .select("id")
      .single();
    check(
      'a college school may insert a course as "lecture"',
      !collegeCourseError,
      collegeCourseError?.message,
    );

    if (collegeCourse) {
      for (const category of HIGHER_ED) {
        const result = await write("courses", collegeCourse.id, college.id, category);
        check(`a college school may set a course to "${category}"`, result.accepted, result.message);
      }
    }
  } finally {
    await admin.from("schools").delete().in("id", [secondary.id, college.id]);
  }

  report();
};

run().catch((e) => {
  fail++;
  console.log(`  FAIL  harness error: ${e?.message ?? e}`);
  report();
});
