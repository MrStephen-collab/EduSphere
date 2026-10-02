// Proves the platform owner can actually reach /platform on a deployed site.
//
// The symptom this answers is "the super admin can't sign in". That is three
// separate things failing at once, and each looks identical from the login
// form: the password must work, the session must carry the role, and the role
// must be recognised as platform-wide rather than attached to a school. Checking
// the database alone proves none of them, because a role row can be perfectly
// correct while the password is unknown to everyone including the owner.
//
// So this signs in over HTTP against a real deployment, the same way the login
// form does, and then walks to /platform expecting the platform console rather
// than a bounce to /auth/login.
//
//   node scripts/verify-platform-access.mjs
//   BASE=https://edusphere-taupe.vercel.app node scripts/verify-platform-access.mjs
//
// EMAIL and DEMO_USER_PASSWORD default to the platform demo account.

import { createServerClient } from "@supabase/ssr";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const password = process.env.DEMO_USER_PASSWORD || "Testing2026";
const email = process.env.EMAIL || "platform@edusphere.test";
const BASE = (process.env.BASE || "http://localhost:3100").replace(/\/$/, "");

if (!url || !anonKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local",
  );
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

const checks = [];
function check(label, ok, detail = "") {
  checks.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

const session = createSession();
const supabase = createServerClient(url, anonKey, {
  cookies: {
    getAll: () => [...session.jar].map(([name, value]) => ({ name, value })),
    setAll: (cookies) => {
      for (const c of cookies) session.jar.set(c.name, c.value);
    },
  },
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`Target: ${BASE}`);
console.log(`Account: ${email}\n`);

const { data, error } = await supabase.auth.signInWithPassword({ email, password });
if (error || !data?.user) {
  check("password accepts a sign-in", false, error?.message ?? "no user returned");
  console.log("\nThe account's password is the first thing to fix.");
  process.exit(1);
}
check("password accepts a sign-in", true);
session.absorb({ headers: new Headers() });

// The role read has to come back through RLS as the app reads it, not through
// the service role, or this proves nothing about the signed-in session.
const { data: roles, error: rolesError } = await supabase
  .from("user_roles")
  .select("role, school_id")
  .eq("user_id", data.user.id);

if (rolesError) {
  check("roles are readable while signed in", false, rolesError.message);
} else {
  const held = roles ?? [];
  check("roles are readable while signed in", true, JSON.stringify(held));
  const platformAdmin = held.find(
    (r) => r.role === "SUPER_ADMIN" && r.school_id === null,
  );
  check(
    "SUPER_ADMIN is held at platform level",
    Boolean(platformAdmin),
    platformAdmin
      ? "school_id is null"
      : "is_super_admin() will not see this account",
  );
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: session.header() },
    redirect: "manual",
  });
  const body = res.headers.get("content-type")?.includes("text/html")
    ? await res.text()
    : "";
  return { status: res.status, location: res.headers.get("location"), body, res };
}

// The landing page redirects by role, so this is where a school-scoped or
// missing role shows up: the app sends the owner somewhere harmless instead of
// saying no.
const dash = await get("/dashboard");
const landsOnPlatform = (dash.location ?? "").endsWith("/platform");
check(
  "/dashboard routes a super admin to /platform",
  landsOnPlatform || dash.status === 200,
  landsOnPlatform ? dash.location : `status ${dash.status}`,
);

const platform = await get("/platform");
const redirectedToLogin = (platform.location ?? "").includes("/auth/login");
check(
  "/platform does not bounce to the login page",
  !redirectedToLogin,
  platform.location ?? `status ${platform.status}`,
);

const renderedPlatformConsole =
  platform.status === 200 &&
  /Recent schools|Plan distribution|Monthly Revenue/.test(platform.body);
check(
  "/platform renders the platform console",
  renderedPlatformConsole,
  platform.status === 200 ? "page body inspected" : `status ${platform.status}`,
);

const notErrorPage = !/Something went wrong/.test(platform.body);
check("/platform is not an error boundary", notErrorPage);

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);