#!/usr/bin/env node
// EduSphere — Page smoke test
//
// Renders every dashboard page as each demo role and fails if a page errors
// out, bounces to a redirect, or returns a data error from PostgREST. This is
// the guard that catches broken service-layer queries: an invalid embed or a
// missing column throws inside a Server Component, which streams a bare
// loading shell instead of the page, so the response is a thin 200 that a
// status-code check alone would happily pass.
//
// Prerequisite: a running server. Either
//   npm run build && npm run app      (production, port 3100)
//   npm run dev                       (development)
// then
//   node scripts/smoke-pages.mjs
//
// Point it elsewhere with BASE=http://localhost:3000 node scripts/smoke-pages.mjs
//
// Sessions are real RLS logins (anon key + signInWithPassword) exactly as the
// application does them, so a failure here means a real user sees a broken page.
//
// Exit code: 0 all pass, 1 any failure.

import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const password = process.env.DEMO_USER_PASSWORD || "Testing2026";
const base = process.env.BASE || "http://localhost:3100";

if (!url || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

// A page that rendered for real is tens of KB. An unauthenticated redirect or a
// Server Component that threw both come back as a ~25 KB shell, so the size
// floor is what separates "page rendered" from "page never happened".
const MIN_BYTES = 30000;

const FATAL_MARKERS = [
  "does not exist in the schema cache",
  "is not a relation",
  "PGRST",
  "Application error",
  "Internal Server Error",
  "Unhandled Runtime Error",
];

// ---------------------------------------------------------------------------
// Tiny harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures = [];

function ok(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  ✔ ${name}${extra ? ` — ${extra}` : ""}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ✖ ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

function section(title) {
  console.log(`\n== ${title} ==`);
}

/**
 * Cookie jar that signs in once per role and then tracks whatever the server
 * writes back. GoTrue rotates the refresh token on use, so replaying a stale
 * cookie would drop the session part-way through the run.
 */
function createSession() {
  const jar = new Map();

  return {
    jar,
    header: () => [...jar].map(([name, value]) => `${name}=${value}`).join("; "),
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
  if (error) throw new Error(`signIn failed for ${email}: ${error.message}`);
  return session;
}

const ROLES = [
  {
    email: "admin@greenfield.test",
    routes: [
      "/school",
      "/school/analytics",
      "/school/announcements",
      "/school/billing",
      "/school/classes",
      "/school/complaints",
      "/school/events",
      "/school/fees",
      "/school/media",
      "/school/parents",
      "/school/results",
      "/school/sessions",
  "/school/timetable",
      "/school/live",
      "/school/students",
      "/school/subjects",
      "/school/teachers",
    ],
  },
  {
    email: "teacher@greenfield.test",
    routes: [
      "/teacher",
      "/teacher/analytics",
      "/teacher/assignments",
      "/teacher/attendance",
      "/teacher/classes",
  "/teacher/timetable",
      "/teacher/live",
      "/teacher/courses",
      "/teacher/exam-series",
      "/teacher/profile",
      "/teacher/question-bank",
      "/teacher/report-cards",
    ],
  },
  {
    email: "student@greenfield.test",
    routes: [
      "/student",
      "/student/assignments",
      "/student/courses",
      "/student/exam-series",
      "/student/fees",
      "/student/fees/statement",
      "/student/fees/receipt/00000000-0000-0000-0000-000000000000",
      "/student/profile",
      "/student/progress",
      "/student/report-cards",
  "/student/timetable",
      "/student/live",
    ],
  },
  {
    email: "parent@greenfield.test",
    routes: [
      "/parent",
      "/parent/assignments",
      "/parent/children",
      "/parent/complaints",
      "/parent/fees",
      // The statement renders for whichever child resolves first. The receipt
      // route needs a real payment id, so this exercises the "no receipt
      // available" branch -- enough to prove the page, its service read and the
      // RLS filter all render instead of throwing.
      "/parent/fees/statement",
      "/parent/fees/receipt/00000000-0000-0000-0000-000000000000",
      "/parent/progress",
      "/parent/report-cards",
      "/parent/results",
    ],
  },
];

// ---------------------------------------------------------------------------
// 1. Server reachable
// ---------------------------------------------------------------------------
console.log("\nPAGE SMOKE TEST — EduSphere");
section("1. Server");

try {
  const res = await fetch(`${base}/auth/login`, { redirect: "manual" });
  ok(`${base} is serving`, res.status < 400, `status ${res.status}`);
} catch (err) {
  console.error(`\nCannot reach ${base}: ${err.message}`);
  console.error("Start a server first:  npm run build && npm run app");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Every page renders for its role
// ---------------------------------------------------------------------------
for (const { email, routes } of ROLES) {
  section(email);

  let session;
  try {
    session = await signIn(email);
  } catch (err) {
    ok(`sign in ${email}`, false, err.message);
    continue;
  }
  ok(`signed in as ${email}`, true);

  for (const route of routes) {
    let res;
    try {
      res = await fetch(`${base}${route}`, {
        headers: { cookie: session.header() },
        redirect: "manual",
      });
    } catch (err) {
      ok(route, false, `transport: ${err.message}`);
      continue;
    }

    session.absorb(res);
    const html = await res.text();

    const fatal = FATAL_MARKERS.find((m) => html.includes(m));
    const digest = html.includes("digest");
    const thin = html.length < MIN_BYTES;

    let problem = "";
    if (res.status >= 400) problem = `status ${res.status}`;
    else if (fatal) problem = `data error: ${fatal}`;
    else if (digest) problem = "server component threw (error digest in payload)";
    else if (thin) problem = `redirect or empty shell (${html.length} bytes)`;

    ok(route, !problem, problem || `${html.length} bytes`);
  }
}

// ---------------------------------------------------------------------------
// 3. Summary
// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("Failed: " + failures.join(", "));
}
process.exit(failed ? 1 : 0);
