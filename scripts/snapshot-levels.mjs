import dotenv from "dotenv";
import { installHttp1Fetch } from "./lib/http1-fetch.mjs";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
installHttp1Fetch();
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TABLES = [
  "classes",
  "subjects",
  "departments",
  "grades",
  "teachers",
  "students",
  "parents",
  "teacher_classes",
  "teacher_subjects",
  "courses",
  "course_modules",
  "lessons",
  "assignments",
  "assignment_submissions",
  "exam_series",
  "exam_sections",
  "question_banks",
  "questions",
  "question_options",
  "practice_attempts",
  "practice_answers",
  "examinations",
  "results",
  "attendance_records",
  "timetable_periods",
  "timetable_entries",
  "live_sessions",
  "live_attendance_records",
  "fee_invoices",
  "fee_payments",
  "admission_settings",
  "admission_applications",
  "admission_events",
  "announcements",
  "notifications",
  "school_events",
  "school_gallery",
  "complaints",
  "complaint_messages",
  "subscriptions",
  "payments",
  "student_progress",
  "lesson_progress",
  "terms",
  "academic_sessions",
];

const { data: schools } = await supabase
  .from("schools")
  .select("id,name,slug,education_level")
  .order("slug");

const snapshot = {};
for (const school of schools) {
  const counts = {};
  for (const table of TABLES) {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("school_id", school.id);
    if (!error) counts[table] = count;
  }
  snapshot[school.slug] = counts;
}

console.log(JSON.stringify(snapshot, null, 1));
