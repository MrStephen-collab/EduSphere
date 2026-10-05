// Proves the school-structure surface is reachable and level-aware, rather than
// only present in the service layer.
//
// The gap this answers: getDepartments, createDepartment, deleteDepartment and
// setSchoolEducationLevel all existed and all were unreachable -- no page, no
// component, no action. A feature that cannot be opened is not shipped, however
// good the code behind it is, so this signs in as a school admin and checks the
// structure page renders, offers every level, and reaches the class form's
// level-aware naming.
//
// The negative assertions are the ones that matter:
//
//   - a level the school has not declared must not be described as if it had.
//   - the class form must not offer a Department picker to a secondary school,
//     because that is the shape of the bug this whole foundation is guarding
//     against: a JSS 1 class assigned to a faculty.
//   - a teacher must not be able to reach the page at all.
//
// It reads the rendered pages, not the code that builds them, because a page that
// throws looks exactly like a page that is not linked from anywhere.
//
// Run with: npm run build && npm run app, then: npm run verify:structure

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
  return { status: res.statusCode ?? res.status, location: res.headers.get("location"), html: await res.text() };
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

/** Markers that can only be present if the guarded body actually rendered. */
const STRUCTURE_MARKERS = [
  'id="education-level"',
  'value="polytechnic"',
  "keep the names they already have",
];

const run = async () => {
  // The school under test is whichever one the admin account belongs to, found
  // through the same membership row the app uses. Not by slug: the seeded slug is
  // "greenfield-college", and the RLS verifiers leave their own throwaway schools
  // behind, so a slug guess either misses or picks up someone else's row.
  const adminSession = await signIn("admin@greenfield.test");
  const asAdmin = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [...adminSession.jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const c of cookies) adminSession.jar.set(c.name, c.value);
      },
    },
  });
  const {
    data: memberships,
    error: membershipError,
  } = await asAdmin.from("user_roles").select("school_id, role").limit(50);
  if (membershipError) throw new Error(membershipError.message);
  const schoolId = memberships?.[0]?.school_id;
  if (!schoolId) throw new Error("the admin account has no school membership -- run `node scripts/seed.mjs`");

  const { data: school, error } = await admin
    .from("schools")
    .select("id, name, slug, education_level")
    .eq("id", schoolId)
    .single();
  if (error) throw new Error(error.message);

  const declaredLevel = school.education_level ?? null;
  console.log(`\nTarget: ${BASE}\nSchool: ${school.name} (level ${declaredLevel ?? "unset"})\n`);

  const STRUCTURE = await get("admin@greenfield.test", "/school/structure");
  check(
    "structure page renders for a school admin",
    STRUCTURE.status === 200 && !STRUCTURE.location,
    STRUCTURE.location ? `redirected to ${STRUCTURE.location}` : `status ${STRUCTURE.status}`,
  );

  check(
    "the page is named for what it sets",
    STRUCTURE.html.includes("Education level"),
    "no education level control on the page",
  );

  // Every level must be offered. A picker that silently omits one is how a
  // polytechnic ends up unable to declare itself a polytechnic.
  for (const level of ["nursery", "primary", "secondary", "college", "polytechnic", "university"]) {
    check(`the level picker offers ${level}`, STRUCTURE.html.includes(`value="${level}"`));
  }

  check(
    "the page explains that existing classes are not renamed",
    STRUCTURE.html.includes("keep the names they already have"),
    "an admin has no way to know a level change leaves their classes alone",
  );

  // The declared level, if any, must be shown as chosen. The select renders
  // selected on the option itself, so the marker is the selected attribute.
  if (declaredLevel) {
    check(
      `the school declares ${declaredLevel} and the picker shows it`,
      STRUCTURE.html.includes(`value="${declaredLevel}" selected`),
      "the picker does not reflect the school's stored level",
    );
  } else {
    check(
      "an unset level is explained rather than silently defaulted",
      STRUCTURE.html.includes("Not set"),
      "no indication that an unset level means something",
    );
  }

  const CLASSES = await get("admin@greenfield.test", "/school/classes");
  check(
    "classes page renders for a school admin",
    CLASSES.status === 200 && !CLASSES.location,
    CLASSES.location ? `redirected to ${CLASSES.location}` : `status ${CLASSES.status}`,
  );

  // The picker the level decides. A secondary school offered a Department
  // dropdown is the exact failure this foundation exists to prevent.
  const offersDepartment = CLASSES.html.includes('id="class-department"');
  const offersProgramme = CLASSES.html.includes('id="class-programme"');
  if (declaredLevel === "polytechnic") {
    check("a polytechnic is offered a programme", offersProgramme);
  } else {
    check(
      "a school that is not a polytechnic is not offered a programme",
      !offersProgramme,
      "OND/HND is a polytechnic concept and should not appear here",
    );
  }
  if (["college", "polytechnic", "university"].includes(declaredLevel)) {
    check("a higher-education school is offered a department", offersDepartment);
  } else {
    check(
      "a school below higher education is not offered a department",
      !offersDepartment,
      "a secondary school's classes must not be assignable to a department",
    );
  }

  // Suggestions must come from the level, not from a hardcoded list.
  if (declaredLevel === "secondary") {
    check(
      "a secondary school is offered JSS and SS class names",
      CLASSES.html.includes("JSS 1") && CLASSES.html.includes("SS 3"),
      "the class name suggestions do not follow the declared level",
    );
  }

  // The gate itself.
  //
  // Not asserted as a redirect status. Next 16 streams: the shell and the <head>
  // are already flushed by the time requireSchoolAdmin() throws, so a blocked
  // request comes back 200 carrying a shell and an in-band redirect. /school/classes
  // behaves the same way, so this is the app's shape and not something this page
  // introduced. What actually matters is that the controls never arrive, which is
  // what is asserted here -- a teacher who sees an empty shell has been refused
  // just as surely as one who was redirected.
  const teacherBlocked = await get("teacher@greenfield.test", "/school/structure");
  check(
    "a teacher does not receive the structure controls",
    !STRUCTURE_MARKERS.some((marker) => teacherBlocked.html.includes(marker)),
    "a teacher was served the level picker",
  );
  check(
    "a teacher's response is not the structure page",
    !teacherBlocked.html.includes("keep the names they already have"),
    "the level consequences were rendered for a teacher",
  );

  const studentBlocked = await get("student@greenfield.test", "/school/structure");
  check(
    "a student does not receive the structure controls",
    !STRUCTURE_MARKERS.some((marker) => studentBlocked.html.includes(marker)),
    "a student was served the level picker",
  );

  // The nav entry, because a page nothing links to is the failure mode this
  // whole surface had. Matched loosely on the href alone: React escapes the
  // attribute differently depending on whether it is in the markup or in the
  // flight payload, and only the presence of the link matters here.
  const NAV = await get("admin@greenfield.test", "/school");
  check(
    "the school navigation links to the structure page",
    NAV.html.includes("/school/structure") && NAV.html.includes("Structure"),
    "no navigation entry, so the page is only reachable by typing the URL",
  );

  // The claim that actually needs proving: the declared level changes the form.
  //
  // Everything above runs against the seeded school, which is secondary, so it can
  // only ever show the negative half -- that a secondary school is not offered a
  // department. To show the level is what decides, the school is temporarily
  // declared a polytechnic with two departments, the page is read again, and
  // everything is put back. A dropdown that ignores the level would pass every
  // assertion above and fail here.
  //
  // Restored in a finally: a verifier that leaves a school in the wrong state is
  // worse than one that fails, because the next run and the demo both inherit it.
  const originalLevel = declaredLevel;
  const probeDepartments = ["Computer Science", "Electrical Engineering"];
  const clearProbeDepartments = async () => {
    await admin
      .from("departments")
      .delete()
      .eq("school_id", school.id)
      .in("name", probeDepartments);
  };
  try {
    // Cleared first, not just at the end. A previous run that died mid-probe
    // leaves these behind, and this inserts them again -- so a rerun has to start
    // from the same state as the first run or it is testing its own leftovers.
    await clearProbeDepartments();
    const { error: deptError } = await admin
      .from("departments")
      .insert(probeDepartments.map((name) => ({ school_id: school.id, name })));
    if (deptError) throw new Error(deptError.message);

    const { error: levelError } = await admin
      .from("schools")
      .update({ education_level: "polytechnic" })
      .eq("id", school.id);
    if (levelError) throw new Error(levelError.message);

    const POLY = await get("admin@greenfield.test", "/school/classes");
    check(
      "a polytechnic is offered a department once it has one",
      POLY.html.includes('id="class-department"'),
      "the department picker did not appear at polytechnic level",
    );
    check(
      "a polytechnic is offered a programme",
      POLY.html.includes('id="class-programme"'),
      "the programme picker did not appear at polytechnic level",
    );
    check(
      "the programme options are OND and HND",
      POLY.html.includes('value="OND"') && POLY.html.includes('value="HND"'),
      "a polytechnic's programmes are not OND and HND",
    );
    check(
      "class names are qualified by department and programme",
      POLY.html.includes("Computer Science OND Year 1"),
      "the suggestions do not follow the declared level",
    );
    check(
      "both departments are offered on the class form",
      POLY.html.includes("Computer Science") && POLY.html.includes("Electrical Engineering"),
      "a department is missing from the class form",
    );

    const POLY_STRUCTURE = await get("admin@greenfield.test", "/school/structure");
    check(
      "a polytechnic's page is headed Department, not the generic word",
      POLY_STRUCTURE.html.includes(">Department<"),
      "the group noun did not follow the declared level",
    );
    check(
      "the picker now shows the declared polytechnic level",
      POLY_STRUCTURE.html.includes('value="polytechnic" selected'),
      "the picker does not reflect a level set outside the UI",
    );
  } finally {
    await admin
      .from("schools")
      .update({ education_level: originalLevel })
      .eq("id", school.id);
    await clearProbeDepartments();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});