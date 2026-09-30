// Probes the complaint RLS policies against the real database.
//
// The complaint policies are the part of this feature most likely to be subtly
// wrong, and a policy that compiles is not the same as a policy that denies.
// This creates two unrelated parents, a school, and two complaint threads, then
// signs in as each parent with their own JWT and checks what they can actually
// read and write.
//
// Run with: node scripts/verify-complaint-rls.mjs
// It writes only rows it creates, and removes them at the end.

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL || !SERVICE || !ANON) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

/** Signs in as a user and returns a client that enforces RLS as they do. */
async function clientAs(userId) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: (await admin.auth.admin.getUserById(userId)).data.user.email,
  });
  if (error) throw new Error(`generateLink failed: ${error.message}`);

  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: signInError } = await c.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });
  if (signInError) throw new Error(`verifyOtp failed: ${signInError.message}`);
  return c;
}

const run = async () => {
  const stamp = Date.now();
  const emailA = `rls-a-${stamp}@verify.test`;
  const emailB = `rls-b-${stamp}@verify.test`;

  const made = { users: [], complaints: [], messages: [], schools: [] };

  try {    // --- fixtures -----------------------------------------------------------
    const { data: userA } = await admin.auth.admin.createUser({
      email: emailA,
      email_confirm: true,
      user_metadata: { full_name: "Parent A" },
    });
    const { data: userB } = await admin.auth.admin.createUser({
      email: emailB,
      email_confirm: true,
      user_metadata: { full_name: "Parent B" },
    });
    made.users.push(userA.user.id, userB.user.id);

    for (const [user, name] of [
      [userA.user, "Parent A"],
      [userB.user, "Parent B"],
    ]) {
      await admin.from("profiles").upsert({ id: user.id, full_name: name });
    }

    const { data: school, error: schoolErr } = await admin
      .from("schools")
      .insert({ name: `RLS Verify ${stamp}`, slug: `rls-verify-${stamp}` })
      .select("id")
      .single();
    if (schoolErr || !school) {
      throw new Error(`could not create the test school: ${schoolErr?.message ?? "no row returned"}`);
    }
    const schoolId = school.id;
    made.schools.push(school.id);

    for (const userId of [userA.user.id, userB.user.id]) {
      await admin.from("parents").insert({ school_id: schoolId, user_id: userId });
      await admin.from("user_roles").insert({
        user_id: userId,
        school_id: schoolId,
        role: "PARENT",
      });
    }

    const { data: complaintA } = await admin
      .from("complaints")
      .insert({
        school_id: schoolId,
        raised_by: userA.user.id,
        raised_by_name: "Parent A",
        raised_by_role: "PARENT",
        category: "academics",
        subject: "Parent A private complaint",
      })
      .select("id")
      .single();
    made.complaints.push(complaintA.id);

    await admin.from("complaint_messages").insert({
      complaint_id: complaintA.id,
      author_id: userA.user.id,
      author_name: "Parent A",
      is_from_school: false,
      body: "This is the opening message from Parent A.",
    });

    const { data: complaintB } = await admin
      .from("complaints")
      .insert({
        school_id: schoolId,
        raised_by: userB.user.id,
        raised_by_name: "Parent B",
        raised_by_role: "PARENT",
        category: "fees",
        subject: "Parent B private complaint",
      })
      .select("id")
      .single();
    made.complaints.push(complaintB.id);

    await admin.from("complaint_messages").insert({
      complaint_id: complaintB.id,
      author_id: userB.user.id,
      author_name: "Parent B",
      is_from_school: false,
      body: "This is Parent B's private message.",
    });

    // --- probes -------------------------------------------------------------
    console.log("\nRLS: parents can see their own threads");
    const asA = await clientAs(userA.user.id);
    const asB = await clientAs(userB.user.id);

    const aSees = await asA.from("complaints").select("id, subject");
    const aSubjects = (aSees.data ?? []).map((r) => r.subject);
    check("parent A sees own complaint", aSubjects.includes("Parent A private complaint"));
    check(
      "parent A cannot see parent B's complaint",
      !aSubjects.includes("Parent B private complaint"),
      `saw: ${JSON.stringify(aSubjects)}`,
    );

    const bSees = await asB.from("complaints").select("id, subject");
    const bSubjects = (bSees.data ?? []).map((r) => r.subject);
    check("parent B sees own complaint", bSubjects.includes("Parent B private complaint"));
    check(
      "parent B cannot see parent A's complaint",
      !bSubjects.includes("Parent A private complaint"),
      `saw: ${JSON.stringify(bSubjects)}`,
    );

    console.log("\nRLS: messages follow the thread, not the author");
    const aMessages = await asA.from("complaint_messages").select("body");
    const aBodies = (aMessages.data ?? []).map((r) => r.body);
    check(
      "parent A can read messages in their own thread",
      aBodies.includes("This is the opening message from Parent A."),
    );
    check(
      "parent A cannot read messages in parent B's thread",
      !aBodies.includes("This is Parent B's private message."),
      `saw: ${JSON.stringify(aBodies)}`,
    );

    console.log("\nRLS: a parent cannot post into someone else's thread");
    const crossWrite = await asB.from("complaint_messages").insert({
      complaint_id: complaintA.id,
      author_id: userB.user.id,
      author_name: "Parent B",
      is_from_school: false,
      body: "Parent B trying to write into parent A's thread",
    });
    check(
      "cross-thread insert is rejected",
      Boolean(crossWrite.error),
      crossWrite.error ? "" : "insert unexpectedly succeeded",
    );

    console.log("\nRLS: a parent cannot sign a message as the school");
    const forged = await asA.from("complaint_messages").insert({
      complaint_id: complaintA.id,
      author_id: userA.user.id,
      author_name: "Parent A",
      is_from_school: true,
      body: "This reply is pretending to come from the school",
    });
    check("forged school reply is rejected", Boolean(forged.error), forged.error ? "" : "insert unexpectedly succeeded");

    console.log("\nRLS: a parent cannot resolve or reassign their own complaint");
    // Postgres reports a write that RLS filtered out as *zero affected rows with
    // no error*, so these checks assert on the row count and then re-read to
    // confirm the data is genuinely untouched. Asserting only on `error` would
    // pass for a write that silently did nothing -- and would also pass for a
    // write that silently succeeded.
    const statusWrite = await asA
      .from("complaints")
      .update({ status: "resolved" })
      .eq("id", complaintA.id)
      .select("id, status");
    check(
      "parent cannot mark complaint resolved",
      (statusWrite.data ?? []).length === 0,
      `rows: ${(statusWrite.data ?? []).length}`,
    );

    const afterStatus = await admin
      .from("complaints")
      .select("status")
      .eq("id", complaintA.id)
      .single();
    check(
      "the complaint is still open in the database",
      afterStatus.data?.status === "open",
      `status: ${afterStatus.data?.status}`,
    );

    const assignWrite = await asA
      .from("complaints")
      .update({ assigned_to: userA.user.id })
      .eq("id", complaintA.id)
      .select("id");
    check(
      "parent cannot assign their own complaint",
      (assignWrite.data ?? []).length === 0,
      `rows: ${(assignWrite.data ?? []).length}`,
    );

    console.log("\nRLS: messages are immutable");
    const editMessage = await asA
      .from("complaint_messages")
      .update({ body: "rewritten" })
      .eq("complaint_id", complaintA.id)
      .select("id");
    check(
      "a sent message cannot be edited",
      (editMessage.data ?? []).length === 0,
      `rows: ${(editMessage.data ?? []).length}`,
    );

    const stillOriginal = await admin
      .from("complaint_messages")
      .select("body")
      .eq("complaint_id", complaintA.id)
      .eq("body", "This is the opening message from Parent A.");
    check(
      "the original message text is intact",
      (stillOriginal.data ?? []).length === 1,
      `rows: ${(stillOriginal.data ?? []).length}`,
    );

    const deleteMessage = await asA
      .from("complaint_messages")
      .delete()
      .eq("complaint_id", complaintA.id)
      .select("id");
    check(
      "a sent message cannot be deleted",
      (deleteMessage.data ?? []).length === 0,
      `rows: ${(deleteMessage.data ?? []).length}`,
    );

    const countAfterDelete = await admin
      .from("complaint_messages")
      .select("id")
      .eq("complaint_id", complaintA.id);
    check(
      "the message still exists in the database",
      (countAfterDelete.data ?? []).length >= 1,
      `rows: ${(countAfterDelete.data ?? []).length}`,
    );

    console.log("\nRLS: a parent cannot forge the raiser");
    const impersonate = await asA.from("complaints").insert({
      school_id: schoolId,
      raised_by: userB.user.id,
      raised_by_name: "Parent B",
      raised_by_role: "PARENT",
      category: "staff",
      subject: "Filed in another parent's name",
    });
    check("cannot file a complaint as another parent", Boolean(impersonate.error), impersonate.error ? "" : "insert unexpectedly succeeded");

    console.log("\nRLS: a parent cannot read complaints of an unrelated school");
    // The complaint must belong to somebody else. Giving it to parent A would
    // make it readable through the "raised_by = auth.uid()" rule, which is
    // correct behaviour and would not test the cross-school rule at all.
    const { data: outsider } = await admin.auth.admin.createUser({
      email: `rls-out-${stamp}@verify.test`,
      email_confirm: true,
      user_metadata: { full_name: "Outsider" },
    });
    made.users.push(outsider.user.id);
    await admin.from("profiles").upsert({ id: outsider.user.id, full_name: "Outsider" });

    const { data: otherSchool, error: otherErr } = await admin
      .from("schools")
      .insert({ name: `RLS Verify Other ${stamp}`, slug: `rls-verify-other-${stamp}` })
      .select("id")
      .single();
    if (otherErr || !otherSchool) {
      throw new Error(`could not create the second school: ${otherErr?.message ?? "no row returned"}`);
    }
    made.schools.push(otherSchool.id);

    const { data: otherComplaint } = await admin
      .from("complaints")
      .insert({
        school_id: otherSchool.id,
        raised_by: outsider.user.id,
        raised_by_name: "Outsider",
        raised_by_role: "PARENT",
        category: "other",
        subject: "Complaint at a school parent A has nothing to do with",
      })
      .select("id")
      .single();
    made.complaints.push(otherComplaint.id);

    const crossSchool = await asA.from("complaints").select("id").eq("id", otherComplaint.id);
    check(
      "cannot read another parent's complaint at an unrelated school",
      (crossSchool.data ?? []).length === 0,
      `rows: ${(crossSchool.data ?? []).length}`,
    );

    await admin.from("complaint_messages").insert({
      complaint_id: otherComplaint.id,
      author_id: outsider.user.id,
      author_name: "Outsider",
      is_from_school: false,
      body: "Message in a thread at another school",
    });
    const crossSchoolMessages = await asA
      .from("complaint_messages")
      .select("id")
      .eq("complaint_id", otherComplaint.id);
    check(
      "cannot read messages in a thread at another school",
      (crossSchoolMessages.data ?? []).length === 0,
      `rows: ${(crossSchoolMessages.data ?? []).length}`,
    );

    // A parent can always read the thread they raised, even if they have since
    // left the school -- they still need to see what happened to it.
    const { data: leftComplaint } = await admin
      .from("complaints")
      .insert({
        school_id: otherSchool.id,
        raised_by: userA.user.id,
        raised_by_name: "Parent A",
        raised_by_role: "PARENT",
        category: "other",
        subject: "Raised by parent A at a school they have now left",
      })
      .select("id")
      .single();
    made.complaints.push(leftComplaint.id);

    const ownAfterLeaving = await asA
      .from("complaints")
      .select("id")
      .eq("id", leftComplaint.id);
    check(
      "a parent can still read a thread they raised after leaving the school",
      (ownAfterLeaving.data ?? []).length === 1,
      `rows: ${(ownAfterLeaving.data ?? []).length}`,
    );

    // --- an admin can see the thread, and a teacher cannot -------------------
    console.log("\nRLS: school staff visibility");
    const { data: teacher } = await admin.auth.admin.createUser({
      email: `rls-t-${stamp}@verify.test`,
      email_confirm: true,
      user_metadata: { full_name: "Teacher" },
    });
    made.users.push(teacher.user.id);
    await admin.from("profiles").upsert({ id: teacher.user.id, full_name: "Teacher" });
    await admin.from("teachers").insert({ school_id: schoolId, user_id: teacher.user.id });
    await admin.from("user_roles").insert({
      user_id: teacher.user.id,
      school_id: schoolId,
      role: "TEACHER",
    });

    const asTeacher = await clientAs(teacher.user.id);
    const teacherSees = await asTeacher.from("complaints").select("id");
    check(
      "a teacher cannot read parent complaints",
      (teacherSees.data ?? []).length === 0,
      `rows: ${(teacherSees.data ?? []).length}`,
    );

    const { data: adminUser } = await admin.auth.admin.createUser({
      email: `rls-ad-${stamp}@verify.test`,
      email_confirm: true,
      user_metadata: { full_name: "School Admin" },
    });
    made.users.push(adminUser.user.id);
    await admin.from("profiles").upsert({ id: adminUser.user.id, full_name: "School Admin" });
    await admin.from("user_roles").insert({
      user_id: adminUser.user.id,
      school_id: schoolId,
      role: "SCHOOL_ADMIN",
    });

    const asSchoolAdmin = await clientAs(adminUser.user.id);
    const adminSees = await asSchoolAdmin.from("complaints").select("id");
    check(
      "a school admin sees the school's complaints",
      (adminSees.data ?? []).length >= 2,
      `rows: ${(adminSees.data ?? []).length}`,
    );

    const adminReply = await asSchoolAdmin.from("complaint_messages").insert({
      complaint_id: complaintA.id,
      author_id: adminUser.user.id,
      author_name: "School Admin",
      is_from_school: true,
      body: "An official reply from the school",
    });
    check("a school admin may reply as the school", !adminReply.error, adminReply.error?.message);

    // the parent must then be able to see that official reply
    const aAfterReply = await asA
      .from("complaint_messages")
      .select("body, is_from_school")
      .eq("complaint_id", complaintA.id);
    const parentSeesReply = (aAfterReply.data ?? []).some(
      (m) => m.is_from_school === true && m.body === "An official reply from the school",
    );
    check("the parent can see the school's official reply", parentSeesReply);
  } catch (err) {
    failed++;
    console.log(`  FAIL  harness error: ${err?.message ?? err}`);
    if (err?.stack) console.log(err.stack);
  } finally {
    // --- cleanup ------------------------------------------------------------
    for (const id of made.complaints) {
      await admin.from("complaint_messages").delete().eq("complaint_id", id);
      await admin.from("complaints").delete().eq("id", id);
    }
    for (const userId of made.users) {
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("parents").delete().eq("user_id", userId);
      await admin.from("teachers").delete().eq("user_id", userId);
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
    for (const schoolId of made.schools) {
      await admin.from("schools").delete().eq("id", schoolId);
    }

    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
  }
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
