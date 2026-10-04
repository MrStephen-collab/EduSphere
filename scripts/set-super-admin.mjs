// Grants, revokes and lists platform super admins.
//
// A SUPER_ADMIN is the platform owner: the one account that manages every school
// rather than belonging to one. The role is only recognised when it is held at
// platform level, with school_id null, because that is exactly what
// is_super_admin() looks for:
//
//   select 1 from user_roles
//   where user_id = auth.uid() and role = 'SUPER_ADMIN' and school_id is null
//
// A SUPER_ADMIN row carrying a school_id is invisible to RLS and to the app's
// own role check, which is the usual reason "my super admin can't sign in to
// /platform". This script therefore refuses to write a role that is scoped to a
// school, and repairs one that already is.
//
// Read-only by default: it prints what is there and changes nothing unless
// --email is given.
//
//   node scripts/set-super-admin.mjs                       # list
//   node scripts/set-super-admin.mjs --email a@b.com       # grant
//   node scripts/set-super-admin.mjs --email a@b.com --revoke
//   node scripts/set-super-admin.mjs --email a@b.com --create --password 'pw'
//   node scripts/set-super-admin.mjs --email a@b.com --set-password 'pw'
//
// --create makes the auth user first (email_confirm already set), which is only
// needed if the person has never signed up. It is refused if any other account
// already holds SUPER_ADMIN, so it cannot quietly make a second platform owner.
//
// --set-password is the other half of the same job. A platform owner created by
// hand has a password nobody wrote down, which looks exactly like a broken
// account. Setting it here also signs in as that account to prove the whole
// path works, rather than leaving you to find out at the login form.

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { installHttp1Fetch } from "./lib/http1-fetch.mjs";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
installHttp1Fetch();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function flag(name) {
  return process.argv.includes(name);
}

function option(name) {
  const i = process.argv.indexOf(name);
  if (i === -1) return undefined;
  const next = process.argv[i + 1];
  if (next === undefined || next.startsWith("--")) {
    console.error(`${name} needs a value.`);
    process.exit(1);
  }
  return next;
}

async function findAuthUser(email) {
  // listUsers pages at 1000, which is well past any realistic school count on
  // one deployment; a platform with more than that should pass an id instead.
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw new Error(`Could not list users: ${error.message}`);
    const found = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (found) return found;
    if (data.users.length < 1000) return null;
    page += 1;
  }
}

async function listAdmins() {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id, user_id, school_id, created_at, profiles(email, full_name)")
    .eq("role", "SUPER_ADMIN");
  if (error) throw new Error(`Could not read roles: ${error.message}`);
  return data ?? [];
}

function describe(row) {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const email = profile?.email ?? "(no profile)";
  const who = profile?.full_name ? `${profile.full_name} <${email}>` : email;
  if (row.school_id) {
    return `${who}  [scoped to a school - NOT recognised as a platform admin]`;
  }
  return who;
}

async function showList() {
  const admins = await listAdmins();
  if (admins.length === 0) {
    console.log("No SUPER_ADMIN roles exist yet.");
    console.log(
      "Create one with: node scripts/set-super-admin.mjs --email you@example.com",
    );
    return;
  }
  console.log(`Platform super admins (${admins.length}):`);
  for (const row of admins) {
    console.log(`  ${describe(row)}`);
    console.log(
      `    user ${row.user_id} · granted ${new Date(row.created_at).toISOString().slice(0, 10)}`,
    );
    // A role row without a usable auth account is the quietest failure there
    // is: everything looks right in the database and nobody can sign in.
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const email = profile?.email;
    const auth = email ? await findAuthUser(email) : null;
    if (!email) {
      console.log("    no email on the profile, so sign-in cannot be attempted");
    } else if (!auth) {
      console.log(`    NO AUTH ACCOUNT for ${email} - sign-in will fail`);
    } else {
      const confirmed = auth.email_confirmed_at ? "confirmed" : "NOT confirmed";
      const lastSignIn = auth.last_sign_in_at
        ? new Date(auth.last_sign_in_at).toISOString().slice(0, 16).replace("T", " ")
        : "never signed in";
      console.log(`    ${confirmed} · ${lastSignIn}`);
    }
  }
  const broken = admins.filter((r) => r.school_id);
  if (broken.length > 0) {
    console.log("");
    console.log(
      `${broken.length} of these are attached to a school, so is_super_admin() ignores them.`,
    );
    console.log("Re-grant each one by email to clear the school scope.");
  }
}

async function grant(email, create, password) {
  const existingAdmins = await listAdmins();
  let user = await findAuthUser(email);

  if (!user) {
    if (!create) {
      console.error(`No account found for ${email}.`);
      console.error("Have them sign up first, or re-run with --create.");
      process.exit(1);
    }
    if (existingAdmins.length > 0) {
      console.error(
        `${existingAdmins.length} super admin(s) already exist. Refusing to create a second platform owner.`,
      );
      console.error("Run without --create and grant the existing account instead.");
      process.exit(1);
    }
    const { data: created, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    if (createError) throw new Error(`Could not create the account: ${createError.message}`);
    user = created.user;
    console.log(`Created the account for ${email}.`);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw new Error(`Could not read the profile: ${profileError.message}`);
  if (!profile) {
    console.error(
      `The account ${email} has no profile row, so the app cannot resolve its roles.`,
    );
    console.error("This means the signup trigger did not run for this user.");
    process.exit(1);
  }

  const scoped = existingAdmins.filter(
    (r) => r.user_id === user.id && r.school_id !== null,
  );
  if (scoped.length > 0) {
    const { error: clearError } = await supabase
      .from("user_roles")
      .update({ school_id: null })
      .eq("user_id", user.id)
      .eq("role", "SUPER_ADMIN");
    if (clearError) {
      throw new Error(`Could not clear the school scope: ${clearError.message}`);
    }
    console.log(`Cleared the school scope from ${scoped.length} role row(s).`);
  }

  const { data: roleRow, error: roleError } = await supabase
    .from("user_roles")
    .insert({ user_id: user.id, role: "SUPER_ADMIN", school_id: null })
    .select("id")
    .single();

  if (roleError) {
    if (roleError.code === "23505") {
      console.log(`${email} is already a platform super admin.`);
      return;
    }
    throw new Error(`Could not grant the role: ${roleError.message}`);
  }

  await supabase.from("audit_logs").insert({
    user_id: null,
    school_id: null,
    action: "super_admin_granted",
    entity_type: "user_roles",
    entity_id: roleRow.id,
    metadata: { email, source: "set-super-admin.mjs" },
  });

  console.log(`${email} is now a platform super admin.`);
  console.log("They reach /platform on next sign-in (or after their next page load).");
}

const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Signs in as the account with the ordinary public key and reports what the
 * app itself will see: the roles it can read and whether any of them are
 * platform-wide. This is the same lookup auth-context performs, so a pass here
 * means /platform will let them in.
 */
async function verifySignIn(email, password) {
  if (!anonKey) {
    console.log("  NEXT_PUBLIC_SUPABASE_ANON_KEY is not set, so sign-in was not checked.");
    return;
  }
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error) {
    console.error(`  sign-in still fails: ${error.message}`);
    return;
  }
  const { data: rows } = await anon
    .from("user_roles")
    .select("role, school_id")
    .eq("user_id", data.user.id);
  const roles = rows ?? [];
  if (roles.some((r) => r.role === "SUPER_ADMIN" && r.school_id === null)) {
    console.log(`  signed in as ${email}; SUPER_ADMIN confirmed, lands on /platform.`);
    return;
  }
  const held = roles.map((r) => `${r.role}${r.school_id ? " (school)" : ""}`);
  console.log(
    `  signed in as ${email}; roles: ${held.length > 0 ? held.join(", ") : "none"}.`,
  );
  console.log("  No platform-wide SUPER_ADMIN, so /platform will redirect them to /dashboard.");
}

async function setPassword(email, password) {
  const user = await findAuthUser(email);
  if (!user) {
    console.error(`No account found for ${email}.`);
    process.exit(1);
  }
  const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
  if (error) throw new Error(`Could not set the password: ${error.message}`);
  console.log(`Password set for ${email}.`);
  await verifySignIn(email, password);
}

async function revoke(email) {
  const user = await findAuthUser(email);
  if (!user) {
    console.error(`No account found for ${email}.`);
    process.exit(1);
  }

  const { data: removed, error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", user.id)
    .eq("role", "SUPER_ADMIN");
  if (error) throw new Error(`Could not revoke the role: ${error.message}`);
  if (!removed || removed.length === 0) {
    console.log(`${email} was not a super admin.`);
    return;
  }

  await supabase.from("audit_logs").insert({
    user_id: null,
    school_id: null,
    action: "super_admin_revoked",
    entity_type: "user_roles",
    metadata: { email, source: "set-super-admin.mjs" },
  });

  console.log(`Revoked super admin from ${email}.`);
  console.log("Sign them out and back in, or the cached session keeps the old role.");
}

async function main() {
  const email = option("--email");
  const create = flag("--create");

  if (!email) {
    if (flag("--revoke")) {
      console.error("--revoke needs --email.");
      process.exit(1);
    }
    if (flag("--set-password")) {
      console.error("--set-password needs --email.");
      process.exit(1);
    }
    await showList();
    return;
  }

  if (flag("--revoke")) {
    await revoke(email);
    return;
  }

  if (flag("--set-password")) {
    const password = option("--password") || process.env.DEMO_USER_PASSWORD;
    if (!password) {
      console.error("--set-password needs a password, via --password or DEMO_USER_PASSWORD.");
      process.exit(1);
    }
    await setPassword(email, password);
    return;
  }

  await grant(email, create, option("--password") || process.env.DEMO_USER_PASSWORD);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});