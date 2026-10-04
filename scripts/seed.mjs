import dotenv from "dotenv";
import { installHttp1Fetch } from "./lib/http1-fetch.mjs";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
installHttp1Fetch();
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SCHOOL_ID = "00000000-0000-0000-0000-000000000001";
const PASSWORD = process.env.DEMO_USER_PASSWORD || "Testing2026";

const users = [
  {
    email: "admin@greenfield.test",
    full_name: "Mrs. Adebayo (Admin)",
    role: "SCHOOL_ADMIN",
  },
  {
    email: "teacher@greenfield.test",
    full_name: "Mr. Ogunleye (Teacher)",
    role: "TEACHER",
  },
  {
    email: "student@greenfield.test",
    full_name: "David Adebayo",
    role: "STUDENT",
  },
  {
    email: "parent@greenfield.test",
    full_name: "Mr. Adebayo (Parent)",
    role: "PARENT",
  },
];

async function getUserId(email) {
  const {
    data: { users },
  } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return users.find((u) => u.email === email)?.id ?? null;
}

async function findClass(name) {
  const { data } = await supabase
    .from("classes")
    .select("id")
    .eq("school_id", SCHOOL_ID)
    .eq("name", name)
    .maybeSingle();
  return data?.id ?? null;
}

async function findSubject(name) {
  const { data } = await supabase
    .from("subjects")
    .select("id")
    .eq("school_id", SCHOOL_ID)
    .eq("name", name)
    .maybeSingle();
  return data?.id ?? null;
}

async function seedTeacherRecord() {
  const userId = await getUserId("teacher@greenfield.test");
  if (!userId) return null;

  const { data: existing } = await supabase
    .from("teachers")
    .select("id")
    .eq("school_id", SCHOOL_ID)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("teachers")
    .insert({ school_id: SCHOOL_ID, user_id: userId, title: "Mr.", display_name: "Mr. Ogunleye" })
    .select("id")
    .single();
  if (error) {
    console.error("Failed to create teacher record:", error.message);
    return null;
  }
  return data.id;
}

async function seedStudentAndParent() {
  const studentUserId = await getUserId("student@greenfield.test");
  const parentUserId = await getUserId("parent@greenfield.test");
  if (!studentUserId) return null;

  const classId = await findClass("SS 2");

  const { data: existingStudent } = await supabase
    .from("students")
    .select("id")
    .eq("school_id", SCHOOL_ID)
    .eq("user_id", studentUserId)
    .maybeSingle();

  let studentId = existingStudent?.id ?? null;
  if (!studentId) {
    const { data, error } = await supabase
      .from("students")
      .insert({
        school_id: SCHOOL_ID,
        user_id: studentUserId,
        admission_number: "GF/STU/2026/001",
        class_id: classId,
        gender: "male",
        display_name: "David Adebayo",
      })
      .select("id")
      .single();
    if (error) {
      console.error("Failed to create student record:", error.message);
      return null;
    }
    studentId = data.id;
  }

  if (parentUserId) {
    const { data: existingParent } = await supabase
      .from("parents")
      .select("id")
      .eq("school_id", SCHOOL_ID)
      .eq("user_id", parentUserId)
      .maybeSingle();

    let parentId = existingParent?.id ?? null;
    if (!parentId) {
      const { data, error } = await supabase
        .from("parents")
        .insert({ school_id: SCHOOL_ID, user_id: parentUserId, relationship: "Father", display_name: "Mr. Adebayo" })
        .select("id")
        .single();
      if (error) {
        console.error("Failed to create parent record:", error.message);
      } else {
        parentId = data.id;
      }
    }

    if (parentId) {
      const { error: linkError } = await supabase
        .from("parent_student_relationships")
        .upsert(
          { school_id: SCHOOL_ID, parent_id: parentId, student_id: studentId, relation: "Father" },
          { onConflict: "parent_id,student_id" },
        );
      if (linkError) console.error("Failed to link parent-student:", linkError.message);
    }
  }

  return studentId;
}

async function seedTeacherAssignments(teacherId) {
  if (!teacherId) return;

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("school_id", SCHOOL_ID)
    .order("order", { ascending: true });

  for (const cls of classes ?? []) {
    await supabase.from("teacher_classes").upsert(
      { school_id: SCHOOL_ID, teacher_id: teacherId, class_id: cls.id },
      { onConflict: "teacher_id,class_id,session_id" },
    );
  }

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("school_id", SCHOOL_ID);

  for (const subject of subjects ?? []) {
    await supabase.from("teacher_subjects").upsert(
      { school_id: SCHOOL_ID, teacher_id: teacherId, subject_id: subject.id },
      { onConflict: "teacher_id,subject_id,session_id" },
    );
  }
  console.log(`Linked teacher to ${(classes ?? []).length} classes and ${(subjects ?? []).length} subjects`);
}

async function seedDemoTimetable(teacherId) {
  const { data: session } = await supabase
    .from("academic_sessions")
    .select("id, name")
    .eq("school_id", SCHOOL_ID)
    .eq("is_current", true)
    .maybeSingle();

  if (!session) {
    console.error("No current academic session — skipping timetable");
    return;
  }

  // The shape of the day, with a break in the middle. seq is the display order
  // and is what the unique constraint is on, so a re-run updates rather than
  // duplicating.
  const PERIODS = [
    { name: "Period 1", start: "08:00:00", end: "08:45:00", seq: 0 },
    { name: "Period 2", start: "08:45:00", end: "09:30:00", seq: 1 },
    { name: "Lunch", start: "09:30:00", end: "09:50:00", seq: 2, is_break: true },
    { name: "Period 3", start: "09:50:00", end: "10:35:00", seq: 3 },
    { name: "Period 4", start: "10:35:00", end: "11:20:00", seq: 4 },
    { name: "Period 5", start: "11:20:00", end: "12:05:00", seq: 5 },
    { name: "Period 6", start: "12:05:00", end: "12:50:00", seq: 6 },
  ];

  const { data: periodRows, error: periodError } = await supabase
    .from("timetable_periods")
    .upsert(
      PERIODS.map((p) => ({
        school_id: SCHOOL_ID,
        name: p.name,
        start_time: p.start,
        end_time: p.end,
        seq: p.seq,
        is_break: p.is_break ?? false,
      })),
      { onConflict: "school_id,seq" },
    )
    .select("id, name, seq, is_break");

  if (periodError) {
    console.error("Failed to seed timetable periods:", periodError.message);
    return;
  }

  const lessonPeriods = (periodRows ?? []).filter((p) => !p.is_break);
  if (!lessonPeriods.length) {
    console.error("No lesson periods — skipping timetable");
    return;
  }

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("school_id", SCHOOL_ID);
  const byName = new Map((subjects ?? []).map((s) => [s.name.toUpperCase(), s.id]));

  // Only these, because they are the ones a secondary school actually teaches
  // all week. Anything else would be a gap the demo student can see.
  const rotation = [
    "ENGLISH",
    "MATHEMATICS",
    "PHYSICS",
    "CHEMISTRY",
    "BIOLOGY",
    "CSC",
    "ECONOMICS",
    "GOV",
  ]
    .map((name) => byName.get(name))
    .filter(Boolean);

  if (!rotation.length) {
    console.error("No subjects — skipping timetable");
    return;
  }

  // A second teacher, with no login. Without her, the demo teacher is booked in
  // every period of every day and the "a teacher cannot be in two classes at
  // once" rule has nothing to collide with.
  const { data: secondTeacher, error: teacherError } = await supabase
    .from("teachers")
    .upsert(
      {
        school_id: SCHOOL_ID,
        staff_id: "GF/STF/2026/002",
        title: "Mrs.",
        display_name: "Adesuwa Nwosu",
      },
      { onConflict: "school_id,staff_id" },
    )
    .select("id")
    .maybeSingle();

  if (teacherError) {
    console.error("Failed to seed second teacher:", teacherError.message);
    return;
  }

  const DAYS = [1, 2, 3, 4, 5];
  const rows = [];

  // The demo student's class gets a near-full week, deliberately leaving the
  // last period on two days empty so an unfilled cell is visible.
  const ss2 = await findClass("SS 2");
  if (ss2) {
    lessonPeriods.forEach((period, index) => {
      DAYS.forEach((day) => {
        if (index >= lessonPeriods.length - 1 && day >= 4) return;
        rows.push({
          school_id: SCHOOL_ID,
          session_id: session.id,
          class_id: ss2,
          period_id: period.id,
          day_of_week: day,
          subject_id: rotation[(index * DAYS.length + day) % rotation.length],
          teacher_id: teacherId,
        });
      });
    });
  }

  // A second class on a different teacher, so the grid is not one teacher
  // copied twice and the clash check is meaningful.
  const jss1 = await findClass("JSS 1");
  if (jss1 && secondTeacher?.id) {
    lessonPeriods.slice(0, 4).forEach((period, index) => {
      DAYS.forEach((day) => {
        rows.push({
          school_id: SCHOOL_ID,
          session_id: session.id,
          class_id: jss1,
          period_id: period.id,
          day_of_week: day,
          subject_id: rotation[(index + day + 2) % rotation.length],
          teacher_id: secondTeacher.id,
        });
      });
    });
  }

  const { error } = await supabase
    .from("timetable_entries")
    .upsert(rows, { onConflict: "class_id,session_id,day_of_week,period_id" });

  if (error) {
    console.error("Failed to seed timetable:", error.message);
    return;
  }

  console.log(
    `Seeded ${PERIODS.length} periods and ${rows.length} lessons for ${session.name}`,
  );
}

async function seedDemoCourse(teacherId) {
  if (!teacherId) return;

  const mathSubject = await findSubject("Mathematics");
  const ss2 = await findClass("SS 2");
  if (!mathSubject || !ss2) {
    console.error("Cannot seed demo course: Mathematics subject or SS 2 class missing.");
    return;
  }

  const { data: existingCourse } = await supabase
    .from("courses")
    .select("id")
    .eq("school_id", SCHOOL_ID)
    .eq("title", "SS 2 Mathematics")
    .maybeSingle();

  if (existingCourse) {
    console.log("Demo course already exists");
    return;
  }

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .insert({
      school_id: SCHOOL_ID,
      subject_id: mathSubject,
      class_id: ss2,
      teacher_id: teacherId,
      title: "SS 2 Mathematics",
      description: "Algebra, quadratic equations and beyond for SS 2 students at Greenfield College.",
      status: "published",
    })
    .select("id")
    .single();

  if (courseError) {
    console.error("Failed to create demo course:", courseError.message);
    return;
  }

  const { data: moduleRow } = await supabase
    .from("course_modules")
    .insert({
      school_id: SCHOOL_ID,
      course_id: course.id,
      title: "Quadratic Equations",
      description: "Understand, solve and apply quadratic equations.",
      order: 0,
    })
    .select("id")
    .single();

  const teacherUserId = await getUserId("teacher@greenfield.test");

  const lessons = [
    {
      title: "Introduction to Quadratic Equations",
      description: "What quadratic equations are and why they matter.",
      content:
        "## What is a quadratic equation?\n\nA quadratic equation is an equation of the form:\n\n**ax² + bx + c = 0**\n\nwhere a, b and c are numbers and **a ≠ 0**.\n\n## Why do we care?\n\n- They model real-world motion (thrown balls, moving cars)\n- They appear in physics, engineering and finance\n- They are a core topic across JSS and SS levels\n\n## Quick check\n\n1. Is x² + 2x + 1 = 0 a quadratic equation? Yes.\n2. Is x + 5 = 0 a quadratic equation? No — there is no x² term.",
      status: "published",
    },
    {
      title: "Solving by Factorization",
      description: "Solve quadratics by finding factors.",
      content:
        "## Factorization method\n\nTo solve **x² + 5x + 6 = 0**:\n\n1. Find two numbers that multiply to 6 and add to 5 → **2 and 3**\n2. Write (x + 2)(x + 3) = 0\n3. Set each bracket to zero: **x = -2 or x = -3**\n\n## Remember\n\n- Check your factors multiply to **c**\n- Check they add to **b**\n- A product is zero only when at least one factor is zero",
      status: "published",
    },
    {
      title: "The Quadratic Formula",
      description: "Solve any quadratic equation using the formula.",
      content:
        "## The quadratic formula\n\nFor **ax² + bx + c = 0**, the solutions are:\n\n**x = (-b ± √(b² - 4ac)) / 2a**\n\n## Steps\n\n1. Identify a, b and c\n2. Compute the discriminant b² - 4ac\n3. If the discriminant is positive → two real roots\n4. If it is zero → one repeated root\n5. If it is negative → no real roots\n\n## Example\n\nSolve 2x² - 4x - 6 = 0 using a = 2, b = -4, c = -6.",
      status: "published",
    },
  ];

  for (const lesson of lessons) {
    await supabase.from("lessons").insert({
      school_id: SCHOOL_ID,
      course_id: course.id,
      module_id: moduleRow?.id ?? null,
      title: lesson.title,
      description: lesson.description,
      content: lesson.content,
      status: lesson.status,
      created_by: teacherUserId,
    });
  }

  console.log("Seeded demo course 'SS 2 Mathematics' with 3 lessons");
}

async function seedDemoAssignment(teacherId, studentId) {
  if (!teacherId || !studentId) return;

  const mathSubject = await findSubject("Mathematics");
  const ss2 = await findClass("SS 2");
  if (!mathSubject || !ss2) {
    console.error("Cannot seed demo assignment: Mathematics subject or SS 2 class missing.");
    return;
  }

  const { data: existing } = await supabase
    .from("assignments")
    .select("id")
    .eq("school_id", SCHOOL_ID)
    .eq("title", "Quadratic Equations Practice Set")
    .maybeSingle();

  if (existing) {
    console.log("Demo assignment already exists");
    return;
  }

  const teacherUserId = await getUserId("teacher@greenfield.test");

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 5);

  const { data: assignment, error } = await supabase
    .from("assignments")
    .insert({
      school_id: SCHOOL_ID,
      course_id: null,
      class_id: ss2,
      subject_id: mathSubject,
      title: "Quadratic Equations Practice Set",
      description: "Practice solving quadratic equations by factorization and the quadratic formula.",
      instructions:
        "Solve the following and show all your working.\n\n1. Solve x² + 5x + 6 = 0 by factorization.\n2. Solve 2x² - 4x - 6 = 0 using the quadratic formula.\n3. State the discriminant of 3x² + 2x - 1 = 0 and describe its roots.",
      due_date: dueDate.toISOString(),
      max_score: 100,
      status: "published",
      created_by: teacherUserId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create demo assignment:", error.message);
    return;
  }

  const { error: submissionError } = await supabase
    .from("assignment_submissions")
    .insert({
      school_id: SCHOOL_ID,
      assignment_id: assignment.id,
      student_id: studentId,
      submission_text:
        "1. x² + 5x + 6 = 0 → (x + 2)(x + 3) = 0 → x = -2 or x = -3.\n2. Using the quadratic formula on 2x² - 4x - 6 = 0 gives x = 3 or x = -1.\n3. Discriminant = 2² - 4(3)(-1) = 4 + 12 = 16. Positive so two distinct real roots.",
      status: "submitted",
      submitted_at: new Date().toISOString(),
    });

  if (submissionError) {
    console.error("Failed to create demo submission:", submissionError.message);
  } else {
    console.log("Seeded demo assignment with a pending submission for grading");
  }
}

async function findOrCreatePaperSection(seriesId, title, instructions, position) {
  const { data: existing } = await supabase
    .from("exam_sections")
    .select("id")
    .eq("school_id", SCHOOL_ID)
    .eq("series_id", seriesId)
    .eq("title", title)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from("exam_sections")
    .insert({
      school_id: SCHOOL_ID,
      series_id: seriesId,
      title,
      instructions,
      position,
    })
    .select("id")
    .single();
  if (error) {
    console.error(`Failed to create demo exam section '${title}':`, error.message);
    return null;
  }
  return data;
}

async function seedDemoExamSeries(teacherId, studentId) {
  if (!teacherId || !studentId) return;

  const mathSubject = await findSubject("Mathematics");
  const ss2 = await findClass("SS 2");
  if (!mathSubject || !ss2) {
    console.error("Cannot seed demo exam series: Mathematics subject or SS 2 class missing.");
    return;
  }

  const teacherUserId = await getUserId("teacher@greenfield.test");

  const { data: existing } = await supabase
    .from("exam_series")
    .select("id")
    .eq("school_id", SCHOOL_ID)
    .eq("title", "WAEC Mathematics Practice 2019–2024")
    .maybeSingle();

  let series = existing;
  let bank = null;
  let paperOne;
  let paperTwo;

  if (series) {
    const { data: bankRow } = await supabase
      .from("question_banks")
      .select("id")
      .eq("school_id", SCHOOL_ID)
      .eq("exam_series_id", series.id)
      .is("deleted_at", null)
      .maybeSingle();
    bank = bankRow;
  }

  if (!series) {
    const { data: seriesRow, error } = await supabase
      .from("exam_series")
      .insert({
        school_id: SCHOOL_ID,
        exam_type: "waec",
        title: "WAEC Mathematics Practice 2019–2024",
        year: "2019–2024",
        description:
          "A full simulation of the WAEC SSCE Mathematics paper: objective questions are auto-marked, and the theory (essay) section is marked by your teacher.",
        subject_id: mathSubject,
        class_id: ss2,
        status: "published",
        duration_minutes: 10,
        shuffle_questions: true,
        created_by: teacherUserId,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create demo exam series:", error.message);
      return;
    }
    series = seriesRow;

    paperOne = await findOrCreatePaperSection(
      series.id,
      "Paper 1 — Objective Questions",
      "Answer all questions. Select the single best option for each.",
      0,
    );

    const { data: bankRow, error: bankError } = await supabase
      .from("question_banks")
      .insert({
        school_id: SCHOOL_ID,
        exam_series_id: series.id,
        name: "WAEC Mathematics Practice 2019–2024",
        subject_id: mathSubject,
        class_id: ss2,
        status: "published",
        created_by: teacherUserId,
      })
      .select("id")
      .single();

    if (bankError) {
      console.error("Failed to create demo question bank:", bankError.message);
      return;
    }
    bank = bankRow;

    const objectiveQuestions = [
      {
        question_text: "If x² = 64, what are the two values of x?",
        difficulty: "easy",
        options: [
          { option_text: "8 and -8", is_correct: true },
          { option_text: "8 only", is_correct: false },
          { option_text: "-8 only", is_correct: false },
          { option_text: "32 and -32", is_correct: false },
        ],
        explanation: "Both positive and negative 8 satisfy 8² = 64 and (-8)² = 64.",
      },
      {
        question_text: "Simplify 3/4 + 1/6 and give the answer as a fraction in its lowest terms.",
        difficulty: "medium",
        options: [
          { option_text: "11/12", is_correct: true },
          { option_text: "4/10", is_correct: false },
          { option_text: "13/12", is_correct: false },
          { option_text: "2/5", is_correct: false },
        ],
        explanation: "The LCM of 4 and 6 is 12, so 3/4 = 9/12 and 1/6 = 2/12. 9/12 + 2/12 = 11/12.",
      },
      {
        question_text: "The mean of 6, 8, 10, 12 and 14 is:",
        difficulty: "easy",
        options: [
          { option_text: "10", is_correct: true },
          { option_text: "11", is_correct: false },
          { option_text: "12", is_correct: false },
          { option_text: "9", is_correct: false },
        ],
        explanation: "(6 + 8 + 10 + 12 + 14) / 5 = 50 / 5 = 10.",
      },
      {
        question_text: "If the simple interest on ₦2,000 for 2 years at 5% per annum is:",
        difficulty: "medium",
        options: [
          { option_text: "₦200", is_correct: true },
          { option_text: "₦100", is_correct: false },
          { option_text: "₦400", is_correct: false },
          { option_text: "₦150", is_correct: false },
        ],
        explanation: "I = PRT/100 = (2000 × 5 × 2) / 100 = 200.",
      },
      {
        question_text: "Solve for x: 2x + 3 = 7",
        difficulty: "easy",
        options: [
          { option_text: "x = 2", is_correct: true },
          { option_text: "x = 5", is_correct: false },
          { option_text: "x = 4", is_correct: false },
          { option_text: "x = -2", is_correct: false },
        ],
        explanation: "2x + 3 = 7 → 2x = 4 → x = 2.",
      },
    ];

    for (const q of objectiveQuestions) {
      const { data: question, error: qError } = await supabase
        .from("questions")
        .insert({
          school_id: SCHOOL_ID,
          question_bank_id: bank.id,
          subject_id: mathSubject,
          class_id: ss2,
          section_id: paperOne?.id ?? null,
          question_text: q.question_text,
          question_type: "multiple_choice",
          difficulty: q.difficulty,
          marks: 1,
          explanation: q.explanation,
          created_by: teacherUserId,
        })
        .select("id")
        .single();

      if (qError) {
        console.error("Failed to create demo question:", qError.message);
        continue;
      }

      const { error: oError } = await supabase.from("question_options").insert(
        q.options.map((opt, index) => ({
          school_id: SCHOOL_ID,
          question_id: question.id,
          option_text: opt.option_text,
          is_correct: opt.is_correct,
          position: index,
        })),
      );
      if (oError) console.error("Failed to create demo options:", oError.message);
    }
  } else {
    console.log("Demo exam series already exists — ensuring Paper 2 essay demo");
  }

  if (!bank) {
    console.error("Demo question bank missing — cannot seed essay questions.");
    return;
  }

  // Paper 2 — Essay / theory section (marks are awarded manually by the teacher)
  paperTwo = paperTwo ?? (await findOrCreatePaperSection(
    series.id,
    "Paper 2 — Theory / Essay",
    "Answer ALL questions, showing your working. This section is marked by your teacher.",
    1,
  ));

  // Add the essay questions only if the bank doesn't have them yet
  const { data: essayExisting } = await supabase
    .from("questions")
    .select("id")
    .eq("school_id", SCHOOL_ID)
    .eq("question_bank_id", bank.id)
    .eq("question_type", "essay")
    .is("deleted_at", null)
    .limit(1);

  if (!essayExisting || essayExisting.length === 0) {
    const essayQuestions = [
      {
        question_text: "Solve the pair of simultaneous equations: 2x + y = 11 and x - y = 4. Show all of your working.",
        marks: 8,
        difficulty: "medium",
        answer_guide:
          "M1: Either equation rearranged correctly (e.g. y = 11 - 2x). M1: Substitution or elimination set up correctly. A1: x + ... (alt M2/A2). Allow 3x = 15 → x = 5 (A2). Substituting to find y = 1 (A2). Award full marks for x = 5, y = 1 with valid working.",
        explanation: "From x - y = 4 we get y = x - 4. Substituting: 2x + x - 4 = 11 → 3x = 15 → x = 5, y = 1.",
      },
      {
        question_text: "The marks of eight students in a test are 12, 8, 15, 9, 12, 14, 10 and 6. Calculate the mean, the median and the range of these marks.",
        marks: 5,
        difficulty: "easy",
        answer_guide:
          "Mean: total 86 ÷ 8 = 10.75 (2 marks; 1 for the correct total). Ordered list 6,8,9,10,12,12,14,15 → median = (10 + 12)/2 = 11 (2 marks). Range = 15 - 6 = 9 (1 mark).",
        explanation: "Sum = 86, so the mean is 86/8 = 10.75. Sorted: 6,8,9,10,12,12,14,15 → median 11. Range = 15 - 6 = 9.",
      },
    ];

    for (const q of essayQuestions) {
      const { error: qError } = await supabase.from("questions").insert({
        school_id: SCHOOL_ID,
        question_bank_id: bank.id,
        subject_id: mathSubject,
        class_id: ss2,
        section_id: paperTwo?.id ?? null,
        question_text: q.question_text,
        question_type: "essay",
        answer_guide: q.answer_guide,
        difficulty: q.difficulty,
        marks: q.marks,
        explanation: q.explanation,
        created_by: teacherUserId,
      });
      if (qError) console.error("Failed to create demo essay question:", qError.message);
    }
  }

  // Seed a submitted demo attempt with objective answers + essay answers awaiting marking
  const { data: attemptExisting } = await supabase
    .from("practice_attempts")
    .select("id")
    .eq("school_id", SCHOOL_ID)
    .eq("student_id", studentId)
    .eq("exam_series_id", series.id)
    .eq("status", "submitted")
    .limit(1);

  if (!attemptExisting || attemptExisting.length === 0) {
    const { data: qRows } = await supabase
      .from("questions")
      .select("id, question_type, marks")
      .eq("school_id", SCHOOL_ID)
      .eq("question_bank_id", bank.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    const objective = (qRows ?? []).filter((q) => q.question_type !== "essay");
    const essays = (qRows ?? []).filter((q) => q.question_type === "essay");

    const objIds = objective.map((q) => q.id);
    const { data: optRows } = await supabase
      .from("question_options")
      .select("id, question_id, is_correct")
      .eq("school_id", SCHOOL_ID)
      .in("question_id", objIds)
      .order("position", { ascending: true });

    const correctByQ = new Map();
    const wrongByQ = new Map();
    for (const opt of optRows ?? []) {
      if (opt.is_correct && !correctByQ.has(opt.question_id)) {
        correctByQ.set(opt.question_id, opt.id);
      } else if (!opt.is_correct && !wrongByQ.has(opt.question_id)) {
        wrongByQ.set(opt.question_id, opt.id);
      }
    }

    // Answer all five objectives correctly except the simple-interest one.
    let autoScore = 0;
    const objectiveAnswers = objective.map((q, index) => {
      const correct =
        correctByQ.get(q.id) !== undefined &&
        wrongByQ.get(q.id) !== undefined &&
        index !== 3;
      const selected = correct ? correctByQ.get(q.id) : wrongByQ.get(q.id) ?? correctByQ.get(q.id);
      if (correct && selected) autoScore += Number(q.marks);
      return {
        school_id: SCHOOL_ID,
        question_id: q.id,
        selected_option_id: selected,
        is_correct: correct,
        marks_awarded: correct ? Number(q.marks) : 0,
      };
    });

    const essayTexts = [
      "2x + y = 11 and x - y = 4. From the second equation y = x - 4. Substitute into the first: 2x + (x - 4) = 11, so 3x = 15 and x = 5. Then y = 5 - 4 = 1.",
      "Sorted marks are 6, 8, 9, 10, 12, 12, 14, 15. The median is (10 + 12)/2 = 11. The range is 15 - 6 = 9.",
    ];
    const essayAnswers = essays.map((q, index) => ({
      school_id: SCHOOL_ID,
      question_id: q.id,
      answer_text: essayTexts[index] ?? "See working above.",
      is_correct: null,
      marks_awarded: null,
    }));

    const totalMarks = [...objective, ...essays].reduce((sum, q) => sum + Number(q.marks), 0);
    const startedAt = new Date();
    const submittedAt = new Date(startedAt.getTime() + 9 * 60 * 1000);

    const { data: attempt, error: attemptError } = await supabase
      .from("practice_attempts")
      .insert({
        school_id: SCHOOL_ID,
        exam_series_id: series.id,
        student_id: studentId,
        status: "submitted",
        started_at: startedAt.toISOString(),
        submitted_at: submittedAt.toISOString(),
        score: autoScore,
        total_marks: totalMarks,
        correct_count: objectiveAnswers.filter((a) => a.is_correct).length,
        wrong_count: objectiveAnswers.filter((a) => !a.is_correct).length,
        time_used_seconds: 540,
      })
      .select("id")
      .single();

    if (attemptError) {
      console.error("Failed to create demo practice attempt:", attemptError.message);
    } else {
      const answerRows = [...objectiveAnswers, ...essayAnswers].map((a) => ({
        ...a,
        attempt_id: attempt.id,
        answered_at: submittedAt.toISOString(),
      }));
      const { error: answersError } = await supabase.from("practice_answers").insert(answerRows);
      if (answersError) {
        console.error("Failed to create demo practice answers:", answersError.message);
      } else {
        console.log(
          "Seeded a submitted practice attempt with essay answers awaiting marking " +
            `(objective ${autoScore}/${objective.length} correct, essays pending)`,
        );
      }
    }
  }

  console.log("Demo exam series 'WAEC Mathematics Practice 2019–2024' ready (objectives + essays)");
}

async function seedDemoAttendance(teacherId) {
  const classId = await findClass("SS 2");
  if (!classId) return;
  const markerUserId = teacherId ? await getUserId("teacher@greenfield.test") : null;

  const { data: students } = await supabase
    .from("students")
    .select("id, admission_number")
    .eq("school_id", SCHOOL_ID)
    .eq("class_id", classId);
  if (!students || students.length === 0) {
    console.log("Skipped attendance seed: no students enrolled in SS 2.");
    return;
  }

  const { data: existing } = await supabase
    .from("attendance_records")
    .select("id")
    .eq("school_id", SCHOOL_ID)
    .eq("class_id", classId)
    .limit(1);
  if (existing && existing.length > 0) {
    console.log("Attendance already seeded for SS 2 — skipping.");
    return;
  }

  const dates = [];
  const cursor = new Date();
  while (dates.length < 18) {
    const weekday = cursor.getDay();
    if (weekday >= 1 && weekday <= 5) {
      const month = String(cursor.getMonth() + 1).padStart(2, "0");
      const day = String(cursor.getDate()).padStart(2, "0");
      dates.push(`${cursor.getFullYear()}-${month}-${day}`);
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  dates.reverse();

  const rows = [];
  for (let i = 0; i < dates.length; i++) {
    for (const student of students) {
      let status = "present";
      if (student.admission_number === "GF/STU/2026/001") {
        if ([2, 9].includes(i)) status = "absent";
        else if ([5, 13].includes(i)) status = "late";
        else if (i === 16) status = "excused";
      }
      rows.push({
        school_id: SCHOOL_ID,
        class_id: classId,
        student_id: student.id,
        date: dates[i],
        status,
        marked_by: markerUserId,
      });
    }
  }

  const { error } = await supabase.from("attendance_records").insert(rows);
  if (error) {
    console.error("Failed to seed attendance:", error.message);
  } else {
    console.log(
      `Seeded ${dates.length} school days of attendance for SS 2 (${students.length} students) — ` +
        "report cards now carry a days-present line.",
    );
  }
}

async function seedDemoLiveSessions(teacherId) {
  const classId = await findClass("SS 2");
  if (!classId) {
    console.log("Skipped live session seed: SS 2 class missing.");
    return;
  }
  const markerUserId = teacherId ? await getUserId("teacher@greenfield.test") : null;

  const { data: course } = await supabase
    .from("courses")
    .select("id, title")
    .eq("school_id", SCHOOL_ID)
    .eq("title", "SS 2 Mathematics")
    .maybeSingle();

  let lessonId = null;
  if (course) {
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id")
      .eq("course_id", course.id)
      .order("order_index", { ascending: true })
      .limit(1);
    lessonId = lessons?.[0]?.id ?? null;
  }

  // Every timestamp is relative to the moment the seed runs. A session pinned to
  // a fixed date is a session that is in the past forever, and the demo then
  // shows a list of dead links and a register nobody can open.
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;
  const now = Date.now();
  const at = (offsetMs, durationMs) => ({
    starts_at: new Date(now + offsetMs).toISOString(),
    ends_at: new Date(now + offsetMs + durationMs).toISOString(),
  });

  // One session in each state that matters, so the demo exercises the whole
  // lifecycle rather than a single happy path.
  const PLAN = [
    {
      key: "ended",
      title: "Quadratic equations — worked examples",
      description:
        "We finish the factorising set and start the completing-the-square method. Bring last term's homework.",
      ...at(-2 * DAY, 50 * 60_000),
      status: "ended",
      is_visible_to_students: true,
      register: true,
    },
    {
      key: "live",
      title: "Live: solving simultaneous equations",
      description: "Follow along in your exercise book. The recording is not automatic.",
      ...at(-10 * 60_000, 50 * 60_000),
      status: "live",
      is_visible_to_students: true,
      register: false,
    },
    {
      key: "scheduled",
      title: "Inequalities on a number line",
      description: "Bring a graphing calculator if you have one.",
      ...at(2 * DAY, 50 * 60_000),
      status: "scheduled",
      is_visible_to_students: true,
      register: false,
    },
    {
      key: "draft",
      title: "Rehearsal for the mock exam",
      description: "Not announced yet — the link has not been tested.",
      ...at(5 * DAY, 90 * 60_000),
      status: "scheduled",
      is_visible_to_students: false,
      register: false,
    },
    {
      key: "cancelled",
      title: "Trigonometry catch-up",
      description: "Postponed — the teacher is away.",
      ...at(7 * DAY, 50 * 60_000),
      status: "cancelled",
      is_visible_to_students: true,
      register: false,
    },
  ];

  // Replaced rather than merged. The whole point of these rows is their timing,
  // so there is nothing to match on: leaving the previous run's rows would just
  // add five more sessions that are all in the past.
  await supabase.from("live_sessions").delete().eq("school_id", SCHOOL_ID).eq("class_id", classId);

  const inserted = [];
  for (const plan of PLAN) {
    const { data, error } = await supabase
      .from("live_sessions")
      .insert({
        school_id: SCHOOL_ID,
        class_id: classId,
        course_id: course?.id ?? null,
        lesson_id: lessonId,
        title: plan.title,
        description: plan.description,
        join_url: `https://zoom.us/j/9${Math.floor(1e9 + now % 1e8)}${plan.key}?pwd=demo`,
        starts_at: plan.starts_at,
        ends_at: plan.ends_at,
        status: plan.status,
        is_visible_to_students: plan.is_visible_to_students,
        created_by: markerUserId,
      })
      .select("id, title")
      .single();

    if (error) {
      console.error(`Failed to seed live session "${plan.title}":`, error.message);
      continue;
    }
    inserted.push({ ...data, register: plan.register });
  }

  // The register for the finished session only. It is a mark a person keeps, so
  // it belongs to a session that has already happened -- marking one in advance
  // would be pretending to know the future.
  const pastSession = inserted.find((s) => s.register);
  if (pastSession) {
    const { data: students } = await supabase
      .from("students")
      .select("id, admission_number")
      .eq("school_id", SCHOOL_ID)
      .eq("class_id", classId)
      .order("admission_number", { ascending: true });

    if (students?.length) {
      const { error } = await supabase.from("live_attendance_records").insert(
        students.map((student, index) => ({
          school_id: SCHOOL_ID,
          live_session_id: pastSession.id,
          student_id: student.id,
          status:
            student.admission_number === "GF/STU/2026/002"
              ? "absent"
              : index === 2
                ? "late"
                : "present",
          marked_by: markerUserId,
        })),
      );
      if (error) console.error("Failed to seed the live register:", error.message);
    }
  }

  console.log(
    `Seeded ${inserted.length} live sessions for SS 2 ` +
      `(${PLAN.filter((p) => p.is_visible_to_students).length} announced, 1 draft).`,
  );
}

async function seedSubscriptionPlans() {
  const { data: existing } = await supabase
    .from("subscription_plans")
    .select("id")
    .limit(1);
  if (existing && existing.length > 0) {
    console.log("Subscription plans already seeded — skipping.");
    return;
  }

  const plans = [
    {
      name: "Starter",
      description: "For small schools getting started with digital learning.",
      price: 8000,
      billing_interval: "monthly",
      student_limit: 100,
      teacher_limit: 2,
      status: "active",
      feature_limits: {
        features: [
          "Up to 100 students",
          "2 teachers included",
          "Courses & lessons",
          "Practice quizzes",
          "Email support",
        ],
      },
    },
    {
      name: "Professional",
      description: "For growing schools that need the full academic workflow.",
      price: 24000,
      billing_interval: "monthly",
      student_limit: 500,
      teacher_limit: 20,
      status: "active",
      feature_limits: {
        features: [
          "Up to 500 students",
          "20 teachers included",
          "Full CBT engine",
          "Assignments & grading",
          "Analytics dashboard",
          "Priority support",
        ],
      },
    },
    {
      name: "Premium",
      description: "For larger schools with multiple streams and branches.",
      price: 60000,
      billing_interval: "monthly",
      student_limit: 2000,
      teacher_limit: null,
      status: "active",
      feature_limits: {
        features: [
          "Up to 2,000 students",
          "Unlimited teachers",
          "Advanced analytics",
          "Parent portal",
          "Custom branding",
          "Dedicated support",
        ],
      },
    },
  ];

  const { error } = await supabase.from("subscription_plans").insert(plans);
  if (error) throw new Error(`Failed to seed subscription plans: ${error.message}`);
  console.log("Seeded 3 subscription plans (Starter, Professional, Premium).");
}

async function seedDemoSubscription() {
  const { data: professional } = await supabase
    .from("subscription_plans")
    .select("id, name")
    .eq("name", "Professional")
    .maybeSingle();
  if (!professional) {
    console.log("Skipped subscription seed: Professional plan not found.");
    return;
  }

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("school_id", SCHOOL_ID)
    .limit(1);
  if (existing && existing.length > 0) {
    console.log("Demo subscription already seeded — skipping.");
    return;
  }

  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      school_id: SCHOOL_ID,
      plan_id: professional.id,
      status: "active",
      current_period_start: start.toISOString(),
      current_period_end: end.toISOString(),
      cancel_at_period_end: false,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to seed subscription: ${error.message}`);
  console.log("Seeded active Professional subscription for Greenfield College.");

  const ref = "manual_greenfield_2026_professional";
  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id")
    .eq("provider_reference", ref)
    .maybeSingle();
  if (existingPayment) return;

  const { error: paymentError } = await supabase.from("payments").insert({
    school_id: SCHOOL_ID,
    subscription_id: data.id,
    provider: "manual",
    provider_reference: ref,
    amount: 24000,
    currency: "NGN",
    status: "paid",
    paid_at: start.toISOString(),
    metadata: {
      plan_id: professional.id,
      plan_name: professional.name,
      billing_interval: "monthly",
    },
  });
  if (paymentError) throw new Error(`Failed to seed payment: ${paymentError.message}`);
  console.log("Seeded one paid payment for the demo subscription.");
}

// Fee invoices are the one part of the demo that a bursar normally has to
// create by hand, which left every portal showing an empty fees page. This
// seeds a term's worth so the parent statement, the receipts and the bursar's
// approval queue all have something real to render.
//
// The mix is deliberate: each payment lands in a different state so all of
// them are visible at once, and the third is overpaid so the statement has to
// show a clamped credit rather than pretending the extra was absorbed.
async function seedDemoFees(studentId) {
  if (!studentId) {
    console.log("No student to invoice — skipping fees.");
    return;
  }

  const { data: existing } = await supabase
    .from("fee_invoices")
    .select("id")
    .eq("school_id", SCHOOL_ID)
    .eq("student_id", studentId)
    .limit(1);
  if (existing && existing.length > 0) {
    console.log("Fee invoices already seeded — skipping.");
    return;
  }

  const { data: parentUser } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const parentUserId = parentUser?.users.find(
    (x) => x.email === "parent@greenfield.test",
  )?.id;
  if (!parentUserId) {
    console.log("No parent user to bill — skipping fees.");
    return;
  }

  const { data: parentRow } = await supabase
    .from("parents")
    .select("id")
    .eq("user_id", parentUserId)
    .maybeSingle();
  if (!parentRow) {
    console.log("No parent record to bill — skipping fees.");
    return;
  }

  const term = [
    { description: "First Term Tuition", amount: 125000, paid: 125000, status: "paid", at: "2026-01-12" },
    { description: "Second Term Tuition", amount: 125000, paid: 60000, status: "partially_paid", at: "2026-04-14" },
    { description: "Third Term Tuition", amount: 125000, paid: 0, status: "unpaid", at: "2026-07-13" },
    { description: "Boarding Accommodation", amount: 90000, paid: 0, status: "unpaid", at: "2026-07-13" },
    { description: "Scholarship Award (Merit)", amount: 40000, paid: 0, status: "waived", at: "2026-07-20" },
  ];

  for (const t of term) {
    const { data: invoice, error } = await supabase
      .from("fee_invoices")
      .insert({
        school_id: SCHOOL_ID,
        student_id: studentId,
        description: t.description,
        amount: t.amount,
        amount_paid: t.paid,
        status: t.status,
        due_date: t.at,
      })
      .select("id")
      .single();
    if (error) {
      console.error(`Failed to invoice ${t.description}:`, error.message);
      continue;
    }

    if (t.paid > 0) {
      // The second term payment is tendered at 70000 against 60000 owed, which
      // is the overpayment case: the credit is clamped and the receipt has to
      // say how much was actually applied.
      const tendered = t.description.startsWith("Second") ? 70000 : t.paid;
      const { error: payErr } = await supabase.from("fee_payments").insert({
        school_id: SCHOOL_ID,
        invoice_id: invoice.id,
        parent_id: parentRow.id,
        payer_user_id: parentUserId,
        amount: tendered,
        credited_amount: t.paid,
        status: "approved",
        submitted_at: `${t.at}T09:15:00Z`,
        reviewed_at: `${t.at}T11:00:00Z`,
      });
      if (payErr) console.error(`Failed to pay ${t.description}:`, payErr.message);
    }

    // A third invoice gets a payment still waiting on a bursar, so the school
    // side has something to approve rather than an empty queue.
    if (t.description === "Boarding Accommodation") {
      const { error: pendingErr } = await supabase.from("fee_payments").insert({
        school_id: SCHOOL_ID,
        invoice_id: invoice.id,
        parent_id: parentRow.id,
        payer_user_id: parentUserId,
        amount: 25000,
        status: "submitted",
        submitted_at: "2026-09-28T08:30:00Z",
      });
      if (pendingErr) console.error("Failed to queue payment:", pendingErr.message);
    }
  }

  console.log(`Seeded ${term.length} fee invoices for the demo student.`);
}

async function main() {
  for (const u of users) {
    const {
      data: { user: existing },
    } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

    let userId = existing?.users.find((x) => x.email === u.email)?.id;

    if (!userId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: u.full_name },
      });
      if (error) {
        console.error(`Failed to create ${u.email}:`, error.message);
        continue;
      }
      userId = data.user.id;
      console.log(`Created user ${u.email}`);
    } else {
      console.log(`User ${u.email} already exists`);
    }

    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ school_id: SCHOOL_ID, user_id: userId, role: u.role });

    if (roleError) {
      if (roleError.code === "23505") {
        console.log(`Role ${u.role} already assigned to ${u.email}`);
      } else {
        console.error(`Failed to assign role for ${u.email}:`, roleError.message);
      }
    } else {
      console.log(`Assigned ${u.role} to ${u.email}`);
    }
  }

  console.log("\nSeeding people records…");
  const teacherId = await seedTeacherRecord();
  const studentId = await seedStudentAndParent();
  await seedTeacherAssignments(teacherId);
  await seedDemoTimetable(teacherId);
  await seedDemoCourse(teacherId);
  await seedDemoAssignment(teacherId, studentId);
  await seedDemoExamSeries(teacherId, studentId);
  await seedDemoAttendance(teacherId);
  await seedDemoLiveSessions(teacherId);
  await seedSubscriptionPlans();
  await seedDemoSubscription();
  await seedDemoFees(studentId);

  console.log("Seed complete. Demo password:", PASSWORD);
  console.log(`Student record: ${studentId ?? "not created"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});