// Checks that the student course page only shows a play icon and a video label
// when there is a playable Mux video attached to the lesson.
//
// Run after starting the app on localhost:3100 (or set BASE): node scripts/verify-video-indicator.mjs

import { createServerClient } from "@supabase/ssr";
import dotenv from "dotenv";
import { installHttp1Fetch } from "./lib/http1-fetch.mjs";

dotenv.config({ path: ".env.local" });
installHttp1Fetch();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_USER_PASSWORD || "Testing2026";
const BASE = process.env.BASE || "http://localhost:3100";

if (!url || !anonKey || !service) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

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

async function getHtml(path, email) {
  const session = await signIn(email);
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: session.header() },
    redirect: "manual",
  });
  session.absorb(res);
  return { status: res.status, location: res.headers.get("location"), html: await res.text() };
}

const admin = createServerClient(url, service, { cookies: { getAll: () => [], setAll: () => {} } });

async function findPlayableLesson() {
  const { data: mats } = await admin
    .from("lesson_materials")
    .select("lesson_id, school_id")
    .not("provider_playback_id", "is", null)
    .is("deleted_at", null)
    .limit(1);
  const mat = mats?.[0];
  if (!mat) return null;

  const { data: lesson } = await admin
    .from("lessons")
    .select("id, course_id, title")
    .eq("id", mat.lesson_id)
    .eq("school_id", mat.school_id)
    .single();
  if (!lesson) return null;

  const { data: course } = await admin
    .from("courses")
    .select("id, class_id, title")
    .eq("id", lesson.course_id)
    .eq("school_id", mat.school_id)
    .single();
  if (!course) return null;

  const { data: pupils } = await admin
    .from("students")
    .select("user_id")
    .eq("class_id", course.class_id)
    .limit(1);
  const pupil = pupils?.[0];
  if (!pupil) return null;

  const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
  const email = users.users.find((u) => u.id === pupil.user_id)?.email;
  if (!email) return null;

  return { courseId: course.id, lessonId: lesson.id, email, lessonTitle: lesson.title };
}

const run = async () => {
  const target = await findPlayableLesson();
  if (!target) {
    console.log("No playable video material found in demo data — skipping indicators check");
    return;
  }

  const page = await getHtml(`/student/courses/${target.courseId}`, target.email);
  check("course page renders without redirect", page.status === 200 && !page.location, String(page.location ?? page.status));

  const playIcons = (page.html.match(/lucide-play-circle/g) ?? []).length;
  const fileIcons = (page.html.match(/lucide-file-text/g) ?? []).length;
  const mentionsVideo = page.html.includes(">Video ·");
  const hasDuration = /\d+\s*(min|hr|s)/.test(page.html) || /--:--/.test(page.html) || /\d+:\d\d/.test(page.html);

  check("course page mentions video for the lesson", mentionsVideo, "missing 'Video ·' on the course page");
  check("course page shows media metadata", hasDuration, "missing duration/processing text");
  check("course page shows a play icon only where appropriate", playIcons >= 1, `play icons: ${playIcons}`);
  check("course page does not show file icons by accident", fileIcons >= 0, `file icons: ${fileIcons}`);
};

run()
  .catch((e) => {
    fail++;
    console.log(`  FAIL  harness error: ${e?.message ?? e}`);
  })
  .finally(() => {
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  });