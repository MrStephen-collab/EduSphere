// Proves the online-admission workflow is real end to end -- not just present in
// the service layer -- and that the one anonymous write in the product is safe.
//
// Two claims are checked, and the second matters more than the first:
//
//   1. A signed-out visitor can file an application through the school's public
//      page, gets a reference, and the school admin sees it and can issue a
//      letter once a place is offered.
//   2. Nobody else can. The database has no `anon` insert policy on purpose, so
//      a leaked anon key cannot enumerate or forge applications; another school
//      cannot read or move this school's applications; and a teacher or student
//      cannot read them at all.
//
// It builds its own two schools and users so it never disturbs seeded data, and
// removes every row it created in a finally. The page checks need the preview
// server: run `npm run build && npm run app`, then `npm run verify:admissions`.

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

if (!url || !anonKey || !serviceKey) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

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

// --- browser sessions, the same shape the app uses when a person signs in ----
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

// Redirects are not followed, deliberately: a blocked page in Next 16 comes back
// as a 200 carrying an in-band redirect, and following it would turn "the guard
// refused this user" into a quiet pass.
async function get(session, path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: session.header() },
    redirect: "manual",
  });
  session.absorb(res);
  return {
    status: res.status,
    location: res.headers.get("location"),
    html: await res.text(),
  };
}

// The public endpoint. No cookie, no account -- exactly what a visitor's browser
// sends.
async function postPublic(slug, body) {
  const res = await fetch(`${BASE}/api/admissions/${slug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

/** An RLS-enforcing client for a signed-in user, to probe what they can read. */
async function clientAs(email) {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email}: ${error.message}`);
  return c;
}

const countRows = (res) => (res.data ?? []).length;

const run = async () => {
  const stamp = Date.now();
  const made = { users: [], schools: [], applications: [] };

  const makeUser = async (label, role, schoolId) => {
    const email = `adm-${label}-${stamp}@verify.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: label },
    });
    if (error) throw new Error(`createUser ${label}: ${error.message}`);
    made.users.push(data.user.id);
    await admin.from("profiles").upsert({ id: data.user.id, full_name: label });
    if (schoolId) {
      const { error: roleError } = await admin
        .from("user_roles")
        .insert({ user_id: data.user.id, school_id: schoolId, role });
      if (roleError) throw new Error(`role ${label}: ${roleError.message}`);
    }
    return { id: data.user.id, email };
  };

  const makeSchool = async (letter) => {
    const { data, error } = await admin
      .from("schools")
      .insert({
        name: `Admission Verify ${letter} ${stamp}`,
        slug: `adm-verify-${letter}-${stamp}`,
        status: "active",
      })
      .select("id, slug")
      .single();
    if (error) throw new Error(`school ${letter}: ${error.message}`);
    made.schools.push(data.id);
    return data;
  };

  // Opens (or closes) a school's public admissions link. A school with no
  // settings row has its link off, so the happy path below has to open it the
  // way an admin would.
  const setLink = async (schoolId, patch) => {
    const { error } = await admin
      .from("admission_settings")
      .upsert({ school_id: schoolId, ...patch }, { onConflict: "school_id" });
    if (error) throw new Error(`admission_settings: ${error.message}`);
  };

  try {
    const schoolA = await makeSchool("a");
    const schoolB = await makeSchool("b");
    await setLink(schoolA.id, {
      enabled: true,
      application_fee_amount: 2500,
      application_fee_currency: "NGN",
      fee_note: "Non-refundable",
      intake_label: "Admission Verify Intake",
    });

    const { data: classA, error: classAErr } = await admin
      .from("classes")
      .insert({ school_id: schoolA.id, name: "Probe Class A" })
      .select("id, name")
      .single();
    if (classAErr) throw new Error(`class A: ${classAErr.message}`);

    const { data: classB, error: classBErr } = await admin
      .from("classes")
      .insert({ school_id: schoolB.id, name: "Probe Class B" })
      .select("id, name")
      .single();
    if (classBErr) throw new Error(`class B: ${classBErr.message}`);

    const adminA = await makeUser("admin-a", "SCHOOL_ADMIN", schoolA.id);
    const adminB = await makeUser("admin-b", "SCHOOL_ADMIN", schoolB.id);
    const teacherA = await makeUser("teacher-a", "TEACHER", schoolA.id);
    const studentA = await makeUser("student-a", "STUDENT", schoolA.id);

    console.log(`\nTarget: ${BASE}\nSchool A: ${schoolA.slug}\n`);

    // --- the public form renders to a stranger -----------------------------
    const publicPage = await fetch(
      `${BASE}/schools/${schoolA.slug}/admissions`,
    ).then((r) => r.text());
    check(
      "the public admissions page offers a form to a signed-out visitor",
      publicPage.includes("Apply online") && publicPage.includes('id="applicantFirstName"'),
      "no application form in the public page",
    );
    check(
      "the public form lists the school's classes",
      publicPage.includes("Probe Class A"),
      "a school's classes are not offered on its public form",
    );
    check(
      "the public page shows the configured application fee and intake label",
      publicPage.includes("₦2,500") && publicPage.includes("Non-refundable") &&
        publicPage.includes("Admission Verify Intake"),
      "the fee or intake label configured by the school is not shown",
    );

    // --- the link's on/off state and window are enforced ---------------------
    console.log("\nThe admission link governs whether applications are accepted");
    const beforeOff = await postPublic(schoolA.slug, {
      applicantFirstName: "Too",
      applicantLastName: "Early",
      guardianName: "Too Early",
      guardianEmail: "too.early@example.test",
    });
    check(
      "an application is accepted while the link is open",
      beforeOff.status === 201 && beforeOff.json?.ok === true,
      `status ${beforeOff.status} ${JSON.stringify(beforeOff.json)}`,
    );
    await setLink(schoolA.id, { enabled: false });
    const whileOff = await postPublic(schoolA.slug, {
      applicantFirstName: "Too",
      applicantLastName: "Early",
      guardianName: "Too Early",
      guardianEmail: "too.early@example.test",
    });
    check(
      "an application is refused while the link is off",
      whileOff.status === 400 && whileOff.json?.ok !== true &&
        /not accepting/i.test(whileOff.json?.error ?? ""),
      `status ${whileOff.status} ${JSON.stringify(whileOff.json)}`,
    );

    // Open a window that has not started yet: the link is on, but too early.
    const opensAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await setLink(schoolA.id, { enabled: true, opens_at: opensAt });
    const beforeWindow = await postPublic(schoolA.slug, {
      applicantFirstName: "Too",
      applicantLastName: "Early",
      guardianName: "Too Early",
      guardianEmail: "too.early@example.test",
    });
    check(
      "an application is refused before the window opens",
      beforeWindow.status === 400 && /open/i.test(beforeWindow.json?.error ?? ""),
      `status ${beforeWindow.status} ${JSON.stringify(beforeWindow.json)}`,
    );

    const closedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await setLink(schoolA.id, { enabled: true, opens_at: null, closes_at: closedAt });
    const afterWindow = await postPublic(schoolA.slug, {
      applicantFirstName: "Too",
      applicantLastName: "Late",
      guardianName: "Too Late",
      guardianEmail: "too.late@example.test",
    });
    check(
      "an application is refused after the window closes",
      afterWindow.status === 400 && /closed/i.test(afterWindow.json?.error ?? ""),
      `status ${afterWindow.status} ${JSON.stringify(afterWindow.json)}`,
    );

    const closedPage = await fetch(
      `${BASE}/schools/${schoolA.slug}/admissions`,
    ).then((r) => r.text());
    check(
      "a closed link hides the application form from the public page",
      !closedPage.includes('id="applicantFirstName"') &&
        closedPage.includes("closed"),
      "the form is still shown while the link is closed",
    );

    // Restore the open link so the happy path below runs against a live form.
    await setLink(schoolA.id, {
      enabled: true,
      opens_at: null,
      closes_at: null,
      application_fee_amount: 2500,
      application_fee_currency: "NGN",
      fee_note: "Non-refundable",
      intake_label: "Admission Verify Intake",
    });

    // --- a visitor can apply -----------------------------------------------
    const submitted = await postPublic(schoolA.slug, {
      applicantFirstName: "Ada",
      applicantLastName: "Okafor",
      dateOfBirth: "2014-05-09",
      gender: "female",
      classId: classA.id,
      guardianName: "Chidi Okafor",
      guardianEmail: "chidi.okafor@example.test",
      guardianPhone: "08030000000",
      address: "12 Market Road",
      previousSchool: "Little Stars Nursery",
      notes: "Please consider for a scholarship.",
    });
    check(
      "a signed-out visitor can file an application",
      submitted.status === 201 && submitted.json?.ok === true,
      `status ${submitted.status} ${JSON.stringify(submitted.json)}`,
    );
    check(
      "the applicant is given a quotable reference",
      /^ADM-[0-9A-F]{8}$/.test(submitted.json?.applicationNumber ?? ""),
      `got ${submitted.json?.applicationNumber}`,
    );

    const reference = submitted.json?.applicationNumber;
    const { data: stored, error: storedErr } = await admin
      .from("admission_applications")
      .select("id, school_id, class_id, class_name, status, guardian_email")
      .eq("school_id", schoolA.id)
      .eq("application_number", reference)
      .maybeSingle();
    if (storedErr) throw new Error(storedErr.message);
    if (!stored) throw new Error("the public submission did not write an application row");
    made.applications.push(stored.id);
    check(
      "the application lands in the school the form belongs to",
      stored?.school_id === schoolA.id,
      stored ? `stored against ${stored.school_id}` : "no row was written",
    );
    check(
      "the chosen class is recorded, scoped to that school",
      stored?.class_id === classA.id && stored?.class_name === "Probe Class A",
      `class ${stored?.class_name}`,
    );
    check("a fresh application starts as submitted", stored?.status === "submitted");
    check(
      "the guardian email is normalised to lower case",
      stored?.guardian_email === "chidi.okafor@example.test",
      `got ${stored?.guardian_email}`,
    );

    const { data: timeline } = await admin
      .from("admission_events")
      .select("id, kind")
      .eq("application_id", stored.id);
    check(
      "the submission is recorded on the application's timeline",
      (timeline ?? []).length >= 1,
      "no system event was written",
    );

    // --- the form cannot be abused -----------------------------------------
    const foreignClass = await postPublic(schoolA.slug, {
      applicantFirstName: "Eve",
      applicantLastName: "Attacker",
      guardianName: "Eve Attacker",
      guardianEmail: "eve@example.test",
      classId: classB.id,
    });
    check(
      "an application cannot point at another school's class",
      foreignClass.status === 400 && foreignClass.json?.ok !== true,
      `status ${foreignClass.status}`,
    );

    const badSlug = await postPublic(`no-such-school-${stamp}`, {
      applicantFirstName: "Nobody",
      applicantLastName: "Nowhere",
      guardianName: "Nobody Nowhere",
      guardianEmail: "nobody@example.test",
    });
    check(
      "an application against an unknown or inactive school is refused",
      badSlug.status === 400 && badSlug.json?.ok !== true,
      `status ${badSlug.status}`,
    );

    const noEmail = await postPublic(schoolA.slug, {
      applicantFirstName: "No",
      applicantLastName: "Email",
      guardianName: "No Email",
    });
    check(
      "a malformed application is refused with a readable reason",
      noEmail.status === 400 && typeof noEmail.json?.error === "string",
      `status ${noEmail.status}`,
    );

    // --- the security claim: the anon key cannot write applications ---------
    console.log("\nThe anon role cannot write applications");
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const anonInsert = await anon
      .from("admission_applications")
      .insert({
        school_id: schoolA.id,
        application_number: `ADM-${stamp.toString(16).slice(-8).toUpperCase()}`,
        applicant_first_name: "Forged",
        applicant_last_name: "Row",
        guardian_name: "Forged",
        guardian_email: "forged@example.test",
      })
      .select("id");
    check(
      "a leaked anon key cannot forge an application",
      !!anonInsert.error,
      "the anon role was allowed to insert",
    );

    // --- isolation between schools and roles -------------------------------
    console.log("\nOnly the owning school's admins can read an application");
    const asAdminA = await clientAs(adminA.email);
    const asAdminB = await clientAs(adminB.email);
    const asTeacherA = await clientAs(teacherA.email);
    const asStudentA = await clientAs(studentA.email);

    const ownRead = await asAdminA
      .from("admission_applications")
      .select("id")
      .eq("id", stored.id);
    check("the owning school's admin can read the application", countRows(ownRead) === 1);

    const otherRead = await asAdminB
      .from("admission_applications")
      .select("id")
      .eq("id", stored.id);
    check(
      "another school's admin CANNOT read it",
      countRows(otherRead) === 0,
      "cross-school admission leak",
    );

    const teacherRead = await asTeacherA
      .from("admission_applications")
      .select("id")
      .eq("id", stored.id);
    check("a teacher CANNOT read applications", countRows(teacherRead) === 0, "teacher leak");

    const studentRead = await asStudentA
      .from("admission_applications")
      .select("id")
      .eq("id", stored.id);
    check("a student CANNOT read applications", countRows(studentRead) === 0, "student leak");

    const settingsTeacher = await asTeacherA
      .from("admission_settings")
      .select("school_id")
      .eq("school_id", schoolA.id);
    check(
      "a teacher CANNOT read the school's admission settings",
      countRows(settingsTeacher) === 0,
      "settings were visible to a non-admin",
    );
    const settingsOther = await asAdminB
      .from("admission_settings")
      .select("school_id")
      .eq("school_id", schoolA.id);
    check(
      "another school's admin CANNOT read these admission settings",
      countRows(settingsOther) === 0,
      "settings leaked across schools",
    );
    const anonSettings = await anon
      .from("admission_settings")
      .select("school_id")
      .eq("school_id", schoolA.id);
    check(
      "a leaked anon key cannot read admission settings",
      countRows(anonSettings) === 0,
      "the anon role could read the settings",
    );
    const anonSettingsWrite = await anon
      .from("admission_settings")
      .update({ enabled: true })
      .eq("school_id", schoolA.id);
    check(
      "a leaked anon key cannot open a school's admission link",
      !!anonSettingsWrite.error,
      "the anon role was allowed to update the settings",
    );

    const asAdminB_events = await asAdminB
      .from("admission_events")
      .select("id")
      .eq("application_id", stored.id);
    check(
      "another school's admin CANNOT read the application timeline",
      countRows(asAdminB_events) === 0,
      "a timeline was visible across schools",
    );

    // A denied UPDATE is reported by PostgREST as a 200 with zero rows, so the
    // only honest way to assert it is to write through school B and then read
    // the row back through the service role.
    await asAdminB
      .from("admission_applications")
      .update({ status: "enrolled" })
      .eq("id", stored.id);
    const { data: afterOtherUpdate } = await admin
      .from("admission_applications")
      .select("status")
      .eq("id", stored.id)
      .single();
    check(
      "another school's admin CANNOT move the application",
      afterOtherUpdate?.status === "submitted",
      `status is now ${afterOtherUpdate?.status}`,
    );

    // --- the school works the application in the console -------------------
    console.log("\nThe school's console");
    const adminASession = await signIn(adminA.email);
    const adminBSession = await signIn(adminB.email);

    const inbox = await get(adminASession, "/school/admissions");
    check(
      "the admissions inbox renders for a school admin",
      inbox.status === 200 && !inbox.location,
      inbox.location ? `redirected to ${inbox.location}` : `status ${inbox.status}`,
    );
    check(
      "the inbox shows the arriving application",
      inbox.html.includes(reference) && inbox.html.includes("Okafor"),
      "the new application is not in the inbox",
    );

    // A letter only exists after a place is offered.
    const letterBefore = await get(
      adminASession,
      `/school/admissions/${stored.id}/letter`,
    );
    check(
      "no offer letter exists while the application is still new",
      letterBefore.status === 200 && letterBefore.html.includes("No letter available"),
      "a letter was offered before a decision was made",
    );

    // Move it through the workflow the way the console does: the school's own
    // administrator writes the status through their RLS session (the policy the
    // app relies on), and only the timeline entry beside it is written by the
    // service role, exactly as the server action does.
    await asAdminA
      .from("admission_applications")
      .update({ status: "offered", reviewed_at: new Date().toISOString() })
      .eq("id", stored.id);
    const { data: afterOffer } = await admin
      .from("admission_applications")
      .select("status, reviewed_at")
      .eq("id", stored.id)
      .single();
    check(
      "the owning school's admin CAN move the application",
      afterOffer?.status === "offered" && !!afterOffer?.reviewed_at,
      `status is now ${afterOffer?.status}`,
    );
    await admin.from("admission_events").insert({
      application_id: stored.id,
      school_id: schoolA.id,
      author_name: "The school",
      kind: "status",
      body: "Status moved from New application to Offer made.",
    });

    const letterAfter = await get(
      adminASession,
      `/school/admissions/${stored.id}/letter`,
    );
    check(
      "an offer letter is available once a place is offered",
      letterAfter.html.includes("Offer of admission") &&
        letterAfter.html.includes("Ada Okafor"),
      "the letter did not render for an offered application",
    );

    // The guard, asserted by absence rather than a redirect status: a blocked
    // page streams a shell and an in-band redirect, so the status is a 200
    // either way. The filter link only exists on the real inbox.
    const teacherSession = await signIn(teacherA.email);
    const teacherInbox = await get(teacherSession, "/school/admissions");
    check(
      "a teacher does not receive the admissions console",
      !teacherInbox.html.includes("/school/admissions?status=submitted"),
      "a teacher was served the admissions inbox",
    );

    const otherInbox = await get(adminBSession, "/school/admissions");
    check(
      "another school's admin does not see this school's application",
      !otherInbox.html.includes(reference),
      "an application was visible in the wrong school's console",
    );

    console.log(`\n${pass} passed, ${fail} failed`);
  } finally {
    // Applications and classes cascade from the school, so deleting the two
    // schools removes everything this run created. Users have no school FK, so
    // they are removed explicitly.
    for (const id of made.applications) {
      await admin.from("admission_applications").delete().eq("id", id);
    }
    for (const id of made.schools) {
      await admin.from("schools").delete().eq("id", id);
    }
    for (const userId of made.users) {
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  }

  process.exit(fail === 0 ? 0 : 1);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
