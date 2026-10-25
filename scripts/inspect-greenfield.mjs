import dotenv from "dotenv";
import { installHttp1Fetch } from "./lib/http1-fetch.mjs";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
installHttp1Fetch();
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SCHOOL_ID = "00000000-0000-0000-0000-000000000001";

const picks = {
  fee_invoices: ["id", "student_id", "description", "amount", "amount_paid", "status", "billing_key", "term_id"],
  teachers: ["id", "user_id", "staff_id", "title", "display_name"],
  students: ["id", "user_id", "admission_number", "class_id", "display_name"],
  exam_series: ["id", "title", "exam_type", "status", "duration_minutes", "shuffle_questions"],
  question_banks: ["id", "name", "exam_series_id", "status"],
  questions: ["id", "question_text", "question_type", "marks", "section_id"],
  live_sessions: ["id", "title", "status", "starts_at"],
  timetable_periods: ["id", "name", "seq", "start_time", "end_time", "is_break"],
  academic_sessions: ["id", "name", "is_current", "start_date", "end_date"],
  terms: ["id", "name", "is_current", "starts_at", "ends_at"],
  subscriptions: ["id", "school_id", "plan_id", "status"],
  payments: ["id", "provider", "provider_reference", "amount", "status"],
  practice_attempts: ["id", "exam_series_id", "status", "score", "total_marks"],
  assignments: ["id", "title", "class_id", "max_score", "status"],
  assignment_submissions: ["id", "assignment_id", "student_id", "status", "score"],
  attendance_records: ["id", "date", "status", "class_id"],
  notifications: ["id", "type", "title"],
  announcements: ["id", "title", "target_type"],
  results: ["id", "examination_id", "score"],
  examinations: ["id", "title", "status"],
};

for (const [table, columns] of Object.entries(picks)) {
  const { data, error } = await supabase
    .from(table)
    .select(columns.join(","))
    .eq("school_id", SCHOOL_ID)
    .limit(12);
  if (error) {
    console.log(`${table}: ERROR ${error.message}`);
    continue;
  }
  console.log(`\n--- ${table} (${data.length}) ---`);
  console.log(JSON.stringify(data));
}

const { data: plans } = await supabase.from("subscription_plans").select("id,name,price,billing_interval,status");
console.log("\n--- subscription_plans ---\n" + JSON.stringify(plans));
