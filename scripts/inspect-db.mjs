import dotenv from "dotenv";
import { installHttp1Fetch } from "./lib/http1-fetch.mjs";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
installHttp1Fetch();
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: schools } = await supabase.from("schools").select("id,name,slug,education_level,status").order("created_at");
console.log("SCHOOLS", JSON.stringify(schools, null, 1));

const { data: roles } = await supabase.from("user_roles").select("user_id,role,school_id");
const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
const byId = new Map(users.users.map((u) => [u.id, u.email]));
console.log("PLATFORM ROLES", JSON.stringify(roles.filter((r) => r.school_id === null).map((r) => ({ email: byId.get(r.user_id), role: r.role }))));
console.log("EMAILS", users.users.map((u) => u.email).filter((e) => e?.endsWith(".test")).join(", "));

for (const t of ["departments", "classes", "subjects", "courses", "lessons", "assignments", "assignment_submissions", "exam_series", "questions", "practice_attempts", "results", "examinations", "attendance_records", "timetable_entries", "live_sessions", "fee_invoices", "fee_payments", "admission_applications", "announcements", "notifications", "school_events", "school_gallery", "complaints", "subscriptions", "subscription_plans", "students", "teachers", "parents", "grades", "academic_sessions", "terms", "student_progress", "lesson_progress", "streams", "school_settings", "school_branding"]) {
  const { count } = await supabase.from(t).select("id", { count: "exact", head: true });
  console.log("COUNT", t, count);
}
