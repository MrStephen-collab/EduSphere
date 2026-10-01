// Reads the rendered live teaching pages rather than the code that builds them.
//
// smoke-pages.mjs decides a page worked by counting bytes, which is enough to
// catch a thrown Server Component and not enough to catch a page that renders a
// confident empty state. A schedule can do that easily -- an empty list and a
// list of five sessions look the same at 200 -- so this signs in as all three
// roles and checks the seeded sessions actually reach the page.
//
// The assertions worth their keep are the negative ones:
//
//   - the student must not see the unannounced draft, even though it exists and
//     is in their class. If announcement is not working, this is the leak.
//   - the student must not see the cancelled session's join link.
//   - the student must see the join link for a session that is live now, which
//     is the entire feature.
//   - the teacher's page must offer the register, which is the part that writes.
//
// Run with: npm run build && npm run app, then: npm run verify:live

import { createServerClient } from "@supabase/ssr";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const password = process.env.DEMO_USER_PASSWORD || "Testing2026";
const BASE = process.env.BASE || "http://localhost:3100";

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
  if (error) throw new Error(error.message);
  return session;
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

// fetch follows redirects by default, so a request that bounced to
// /auth/login comes back as a healthy 200 carrying the login page. That turns a
// broken sign-in into "the page renders" and every later assertion quietly
// fails for the wrong reason, so redirects are not followed here.
async function get(role, path) {
  const session = await signIn(role);
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: session.header() },
    redirect: "manual",
  });
  session.absorb(res);
  return { status: res.status, location: res.headers.get("location"), html: await res.text() };
}

function checkPage(name, page, role) {
  check(
    `${name} renders for ${role}`,
    page.status === 200 && !page.location,
    page.location
      ? `redirected to ${page.location}, which means the sign-in did not stick`
      : `status ${page.status}`,
  );
}

// The student page is the one with no editing affordances, so it is also the
// only one where a missing session is a silent failure rather than a visible
// bug. It is checked first.
const STUDENT = await get("student@greenfield.test", "/student/live");
checkPage("student live page", STUDENT, "a student");
check(
  "student sees seeded sessions, not the empty state",
  !STUDENT.html.includes("hasn&#x27;t scheduled any live sessions"),
  "empty state rendered despite seeded sessions",
);
check(
  "student sees the live-now session",
  STUDENT.html.includes("Happening now") || STUDENT.html.includes("Next session"),
  "the seed has one session running and one upcoming; neither reached the page",
);
check(
  "student gets a working join link",
  STUDENT.html.includes("Join session") && /href="https:\/\/zoom\.us\/j\//.test(STUDENT.html),
  "no external join link in the student's list",
);
check(
  "student's join link opens in a new tab",
  STUDENT.html.includes("noopener"),
  "a join link that navigates the student away from EduSphere",
);
check(
  "student does NOT see the unannounced draft",
  !STUDENT.html.includes("Rehearsal for the mock exam"),
  "an unannounced join link was rendered to a class",
);
check(
  "student does NOT see the cancelled session",
  !STUDENT.html.includes("Trigonometry catch-up"),
  "a cancelled session reached the student, in the page or in the props it was sent",
);
check(
  "student does NOT see the teacher's controls",
  !STUDENT.html.includes("Un-announce") && !STUDENT.html.includes("Save register"),
  "a student was served the marking controls",
);
check(
  "student sees their own mark on the finished session",
  STUDENT.html.includes("Your register"),
  "the register for the ended session did not reach the student",
);

const TEACHER = await get("teacher@greenfield.test", "/teacher/live");
checkPage("teacher live page", TEACHER, "a teacher");
check("teacher can schedule a session", TEACHER.html.includes("Schedule session"));
check(
  "teacher sees the draft they have not announced",
  TEACHER.html.includes("Rehearsal for the mock exam"),
  "a teacher cannot see their own unscheduled draft",
);
check(
  "teacher sees the cancelled session too",
  TEACHER.html.includes("Trigonometry catch-up"),
  "a manager's view of the same table drops states the teacher's does not",
);
check(
  "teacher can announce and un-announce",
  TEACHER.html.includes("Announce") && TEACHER.html.includes("Un-announce"),
);
check(
  "teacher gets the register",
  TEACHER.html.includes("Register") && TEACHER.html.includes("Save register"),
  "the teacher can teach but not take a register",
);
check(
  "teacher page explains the register is theirs to keep",
  TEACHER.html.includes("your provider"),
  "the page implies EduSphere observed who joined",
);
check(
  "teacher join links are clickable",
  /href="https:\/\/zoom\.us\/j\//.test(TEACHER.html),
);

const ADMIN = await get("admin@greenfield.test", "/school/live");
checkPage("school live page", ADMIN, "a manager");
check("manager can schedule a session", ADMIN.html.includes("Schedule session"));
check(
  "manager sees sessions across classes",
  ADMIN.html.includes("Rehearsal for the mock exam"),
  "the school-wide overview is missing a session the teacher can see",
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);