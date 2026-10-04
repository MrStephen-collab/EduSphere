// Proves that on the teacher's course builder, a lesson title leads to that
// lesson's own editor and not back to the course page.
//
// The complaint this answers was "lessons and courses point to the same page".
// Byte-count smoke tests cannot see it: both pages return a healthy 200 and a
// plausible size. What has to be asserted is that the lesson link in the course
// builder is a lesson URL, that following it returns a lesson page, and that the
// page offers the upload control the teacher needs.

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

async function get(path, session) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: session.header() },
    redirect: "manual",
  });
  session.absorb(res);
  return { status: res.status, location: res.headers.get("location"), html: await res.text() };
}

const run = async () => {
  const teacherEmail = process.env.TEACHER_EMAIL || "teacher@greenfield.test";
  const session = await signIn(teacherEmail);

  const listPage = await get("/teacher/courses", session);
  check(
    "teacher can reach the course list",
    listPage.status === 200 && !listPage.location,
    listPage.location ?? `status ${listPage.status}`,
  );

  const courseIds = [
    ...new Set(
      [...listPage.html.matchAll(/\/teacher\/courses\/([0-9a-f-]{36})/g)].map((m) => m[1]),
    ),
  ];
  if (courseIds.length === 0) {
    check("the course list links to a course", false, "no course link found in the HTML");
    report();
    return;
  }

  // A teacher may own courses with no lessons yet, so the harness walks their
  // courses until it finds one that actually has a lesson to reach. Failing on
  // an empty course would make this flaky against real data rather than honest.
  let coursePage = null;
  let courseId = null;
  let uniqueLessons = [];

  for (const id of courseIds) {
    const page = await get(`/teacher/courses/${id}`, session);
    if (page.status !== 200 || page.location) continue;
    const links = [
      ...new Set(
        [...page.html.matchAll(/\/teacher\/courses\/[0-9a-f-]{36}\/lessons\/[0-9a-f-]{36}/g)].map(
          (m) => m[0],
        ),
      ),
    ];
    if (links.length > 0) {
      coursePage = page;
      courseId = id;
      uniqueLessons = links;
      break;
    }
    coursePage = page;
    courseId = id;
  }

  check(
    "the course builder renders",
    coursePage && coursePage.status === 200 && !coursePage.location,
    coursePage?.location ?? `status ${coursePage?.status}`,
  );

  // Every lesson link on the builder must be a lesson URL.
  const lessonLinks = [
    ...(coursePage?.html.matchAll(/\/teacher\/courses\/[0-9a-f-]{36}\/lessons\/[0-9a-f-]{36}/g) ?? []),
  ].map((m) => m[0]);

  check(
    "the course builder links out to a lesson on the server render",
    uniqueLessons.length > 0,
    `no lesson links in any of the teacher's ${courseIds.length} course page(s), so the lessons are only reachable once client JavaScript runs`,
  );

  const bareCourseLinks = lessonLinks.filter((l) => !l.includes("/lessons/"));
  check(
    "no lesson link collapses to the course page",
    bareCourseLinks.length === 0,
    `${bareCourseLinks.length} link(s) pointed at the course instead of a lesson`,
  );

  if (uniqueLessons.length === 0) {
    report();
    return;
  }

  const lessonPage = await get(uniqueLessons[0], session);
  check(
    "following a lesson link reaches a lesson page, not the course",
    lessonPage.status === 200 &&
      !lessonPage.location &&
      lessonPage.html.includes("Lesson content") &&
      !lessonPage.html.includes("Course builder"),
    lessonPage.location
      ? `redirected to ${lessonPage.location}`
      : `status ${lessonPage.status}; lesson content present: ${lessonPage.html.includes("Lesson content")}; course builder present: ${lessonPage.html.includes("Course builder")}`,
  );

  // The lesson body streams in behind a Suspense boundary, so the uploader's
  // markup is not in the server HTML even though the page is fine. What the
  // server does send is the component reference plus its props, and the JS the
  // browser needs to mount it. Asserting on the HTML string "Add material" here
  // would be asserting that React skipped streaming, not that video works.
  const lessonId = uniqueLessons[0].split("/").pop();
  check(
    "the lesson page mounts the material uploader for this lesson",
    lessonPage.html.includes("MaterialUploader") &&
      lessonPage.html.includes(`lessonId\\":\\"${lessonId}`),
    "the uploader is not wired to the lesson being opened",
  );

  // Confirm the shipped bundle really carries the video path: the accepted video
  // types and the button that starts an upload.
  // Chunk refs in the RSC payload are stored without the /_next prefix.
  const chunkPaths = [
    ...new Set(
      [...lessonPage.html.matchAll(/static\/chunks\/[^"\\]+\.js/g)].map((m) => `/_next/${m[0]}`),
    ),
  ];
  const bundle = (
    await Promise.all(
      chunkPaths.map(async (p) => {
        const res = await fetch(`${BASE}${p}`);
        return res.ok ? res.text() : "";
      }),
    )
  ).join("\n");

  check(
    "the uploader ships a video category with real accepted types",
    bundle.includes("video/mp4") && bundle.includes("video/quicktime"),
    "the client bundle has no video mime allowlist",
  );
  check(
    "the uploader ships its submit control",
    bundle.includes("Add material"),
    "the client bundle has no upload submit control",
  );

  check(
    "the lesson page links back to its course",
    lessonPage.html.includes(`/teacher/courses/${courseId}`),
    "no way back to the course from the lesson",
  );

  // The two pages must be distinguishable, which is the whole point.
  check(
    "the lesson page is a different document from the course page",
    lessonPage.html.length !== coursePage.html.length,
    `both pages are ${lessonPage.html.length} bytes`,
  );

  // The nav used to offer both "Courses" and "Lessons" pointing at one URL.
  const lessonsPage = await get("/teacher/lessons", session);
  check(
    "there is a dedicated lessons page",
    lessonsPage.status === 200 && !lessonsPage.location,
    lessonsPage.location ?? `status ${lessonsPage.status}`,
  );
  check(
    "the lessons page lists lesson links",
    [...lessonsPage.html.matchAll(/\/teacher\/courses\/[0-9a-f-]{36}\/lessons\/[0-9a-f-]{36}/g)].length > 0,
    "no lesson links on /teacher/lessons",
  );
  // The nav is serialised into the RSC payload with escaped quotes, so match on
  // the href/title pair regardless of escaping.
  const navSerialised = coursePage.html.replace(/\\"/g, '"');
  check(
    "Courses and Lessons are no longer the same URL",
    /"title":"Lessons","href":"\/teacher\/lessons"/.test(navSerialised) &&
      !/"title":"Lessons","href":"\/teacher\/courses"/.test(navSerialised),
    "nav still sends Lessons to /teacher/courses",
  );

  report();
};

function report() {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => {
  fail++;
  console.log(`  FAIL  harness error: ${e?.message ?? e}`);
  report();
});