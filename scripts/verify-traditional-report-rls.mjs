// Probes the traditional_report_cards RLS policies against the real database.
//
// Migration 0035 grants SELECT only:
//   * school managers  — every card in their school
//   * linked teacher   — cards for a class in teacher_classes
//   * the student      — their own card
//   * linked parent    — their child's card
// and deliberately has no INSERT/UPDATE/DELETE policy: writes go through the
// service role in src/services/traditional-report-cards.ts after
// requireContentEditor() has checked the caller.
//
// This harness inserts one throwaway card with the service role, then proves:
//   * the right people can read it and nobody else can,
//   * an authenticated client cannot modify it,
// and removes the probe row at the end.
//
// Run with: node scripts/verify-traditional-report-rls.mjs

import dotenv from "dotenv";
import { installHttp1Fetch } from "./lib/http1-fetch.mjs";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
installHttp1Fetch();
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.DEMO_USER_PASSWORD || "Testing2026";

const GREENFIELD = "00000000-0000-0000-0000-000000000001";

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

async function emailForUser(userId) {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

// ---------------------------------------------------------------------------
// Fixtures: a Greenfield student, their current term, their parent
// ---------------------------------------------------------------------------

const { data: student, error: studentError } = await admin
  .from("students")
  .select("id, user_id, class_id, admission_number, display_name")
  .eq("school_id", GREENFIELD)
  .not("class_id", "is", null)
  .limit(1)
  .maybeSingle();
if (studentError || !student) {
  console.error("Cannot run: no Greenfield student with a class.", studentError?.message ?? "");
  process.exit(1);
}

const { data: session } = await admin
  .from("academic_sessions")
  .select("id, name, terms(id, name, is_current)")
  .eq("school_id", GREENFIELD)
  .eq("is_current", true)
  .maybeSingle();
const term = session?.terms?.find((t) => t.is_current) ?? session?.terms?.[0];
if (!term) {
  console.error("Cannot run: Greenfield has no term in its current session.");
  process.exit(1);
}

const { data: parentRel } = await admin
  .from("parent_student_relationships")
  .select("parent_id, parents(user_id)")
  .eq("student_id", student.id)
  .limit(1)
  .maybeSingle();
const parentUserId = parentRel?.parents?.user_id ?? null;

// A teacher from a different school must not see the card.
const { data: otherTeacherRole } = await admin
  .from("user_roles")
  .select("user_id, school_id")
  .eq("role", "TEACHER")
  .neq("school_id", GREENFIELD)
  .limit(1)
  .maybeSingle();

const [studentEmail, parentEmail, otherTeacherEmail] = await Promise.all([
  student.user_id ? emailForUser(student.user_id) : null,
  parentUserId ? emailForUser(parentUserId) : null,
  otherTeacherRole ? emailForUser(otherTeacherRole.user_id) : null,
]);

// ---------------------------------------------------------------------------
// Insert the probe card as the service role
// ---------------------------------------------------------------------------

const payload = {
  school_id: GREENFIELD,
  student_id: student.id,
  class_id: student.class_id,
  term_id: term.id,
  student_name: `${student.display_name} (RLS probe)`,
  admission_number: student.admission_number,
  class_name: "Probe Class",
  sex: "MALE",
  house: "Probe House",
  session_name: session.name,
  term_name: term.name,
  no_on_roll: 1,
  position: 1,
  total_in_class: 1,
  days_opened: 10,
  days_present: 9,
  days_absent: 1,
  subjects: [{ name: "Mathematics", test1: 10, test2: 10, test3: 10, totalTests: 30, exam: 60, overall: 90 }],
  affective: [{ name: "Punctuality", value: "A" }],
  psychomotor: [{ name: "Sports", value: "B" }],
  comments: { classTeacher: "Probe comment" },
};

// Clear any stale probe from an earlier failed run before inserting.
await admin
  .from("traditional_report_cards")
  .delete()
  .eq("student_id", student.id)
  .eq("term_id", term.id)
  .eq("student_name", payload.student_name);

const { data: inserted, error: insertError } = await admin
  .from("traditional_report_cards")
  .insert(payload)
  .select("id")
  .single();
if (insertError) {
  if (insertError.code === "PGRST205" || insertError.message.includes("schema cache")) {
    console.error("Cannot run: migration 0035 has not been applied (table missing).");
  } else {
    console.error("Cannot run: probe insert failed —", insertError.code, insertError.message);
  }
  process.exit(1);
}
const probeId = inserted.id;

// ---------------------------------------------------------------------------
// Probes
// ---------------------------------------------------------------------------

async function probe(email, label, expectedRows) {
  if (!email) {
    fail(`${label}: no email found for this fixture`);
    return;
  }

  const client = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signInError) {
    fail(`${label}: sign-in failed (${signInError.message})`);
    return;
  }

  const { data, error } = await client
    .from("traditional_report_cards")
    .select("id")
    .eq("id", probeId);

  const rows = error ? -1 : (data?.length ?? 0);
  const readOk = !error && rows === expectedRows;
  const message = error
    ? `${label}: select errored (${error.code} ${error.message})`
    : `${label}: saw ${rows} row(s), expected ${expectedRows}`;
  if (readOk) console.log(`✓ ${message}`);
  else fail(message);

  // No UPDATE policy and no UPDATE grant: the row must be untouchable.
  const write = await client
    .from("traditional_report_cards")
    .update({ student_name: "should not change" })
    .eq("id", probeId)
    .select("id");
  const writeBlocked = Boolean(write.error) || (write.data?.length ?? 0) === 0;
  if (writeBlocked) console.log(`✓ ${label}: write blocked`);
  else fail(`${label}: write was allowed — RLS/grants are wrong`);
}

console.log(`Probe card ${probeId} for ${student.display_name} / ${term.name}\n`);
await probe("teacher@greenfield.test", "greenfield teacher", 1);
await probe("admin@greenfield.test", "greenfield admin", 1);
await probe(studentEmail, "greenfield student", 1);
await probe(parentEmail, "greenfield parent", 1);
await probe(otherTeacherEmail, "other-school teacher", 0);

// ---------------------------------------------------------------------------
// Cleanup + integrity check
// ---------------------------------------------------------------------------

await admin.from("traditional_report_cards").delete().eq("id", probeId);
const { count } = await admin
  .from("traditional_report_cards")
  .select("id", { count: "exact", head: true })
  .eq("id", probeId);
if (count === 0) console.log("\n✓ probe row removed");
else fail(`probe row still present (${count})`);

if (process.exitCode) {
  console.error("\nSome checks failed.");
} else {
  console.log("\nAll traditional report card RLS checks passed.");
}
