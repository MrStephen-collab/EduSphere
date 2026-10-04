// Reads the rendered timetable pages rather than the code that builds them.
//
// smoke-pages.mjs decides a page worked by counting bytes, which is enough to
// catch a thrown Server Component and not enough to catch a page that renders a
// confident empty state. A timetable is exactly the feature that can do that --
// the grid has no error path, it just shows six empty columns -- so this signs
// in as all three roles and checks the seeded lessons actually reach the page.
//
// Run with: npm run build && npm run app, then: npm run verify:timetable

import { createServerClient } from "@supabase/ssr";
import dotenv from "dotenv";
import { installHttp1Fetch } from "./lib/http1-fetch.mjs";

dotenv.config({ path: ".env.local" });
installHttp1Fetch();
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

async function get(role, path) {
  const session = await signIn(role);
  const res = await fetch(`${BASE}${path}`, { headers: { cookie: session.header() } });
  session.absorb(res);
  return { status: res.status, html: await res.text() };
}

const STUDENT = await get("student@greenfield.test", "/student/timetable");
check("student timetable renders", STUDENT.status === 200, `status ${STUDENT.status}`);
check(
  "student sees their class timetable, not the empty state",
  !STUDENT.html.includes("No timetable yet"),
  "empty state rendered despite seeded lessons",
);
check("student grid names a day", STUDENT.html.includes("Monday"));
// The grid runs Monday to Saturday; Sunday is not a school day, so on a Sunday
// the correct page is the week with no column marked. Asserting the marker
// unconditionally made this check fail every weekend.
const isoToday = (() => {
  const day = new Date().getDay();
  return day === 0 ? 7 : day;
})();
const isSchoolDay = isoToday <= 6;
check(
  "student grid marks today",
  isSchoolDay ? STUDENT.html.includes("(today)") : !STUDENT.html.includes("(today)"),
  isSchoolDay
    ? "no column marked on a school day"
    : "Sunday is not a school day, so nothing should be marked",
);
check("student grid shows a seeded subject", /English|Mathematics|Physics|Chemistry|Biology|CSC|Economics|Gov/i.test(STUDENT.html));
check("student grid shows a seeded teacher", /Nwosu|David|Adebayo/i.test(STUDENT.html));
check("student grid shows period times", /\d{2}:\d{2} - \d{2}:\d{2}/.test(STUDENT.html));
check("student grid shows the break", STUDENT.html.includes("break"));

const TEACHER = await get("teacher@greenfield.test", "/teacher/timetable");
check("teacher timetable renders", TEACHER.status === 200, `status ${TEACHER.status}`);
check("teacher editor has no subject picker for colleagues", TEACHER.html.includes("Teachers are assigned by a school admin"));

const ADMIN = await get("admin@greenfield.test", "/school/timetable");
check("school timetable renders", ADMIN.status === 200, `status ${ADMIN.status}`);
check("school admin can edit periods", ADMIN.html.includes("Add period"));
check("school admin gets a teacher picker", ADMIN.html.includes("No teacher"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
