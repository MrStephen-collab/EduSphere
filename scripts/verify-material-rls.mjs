// Probes the lesson_materials RLS policies against the real database.
//
// 0002 gave lesson_materials a flat select policy:
//
//   using (is_super_admin() or is_school_member(school_id))
//
// and is_school_member() is true for pupils as well as staff. The row carries
// the Mux playback id, the storage path and the original file name, so that
// policy let any pupil in the school select every upload in every class. The
// application checked the class only when minting a playback token
// (authorizeMaterialRead in material-storage.ts), which is why a pupil could
// read another class's material titles and file types and only discover the
// refusal when the Watch button failed.
//
// 0023_lesson_material_read_scope.sql puts the class check in the database. This
// harness exists to prove the policy denies rather than merely compiles.
//
// The fixtures are two schools, two classes, two teachers and two pupils: the
// interesting cases are "pupil in the other class", "draft lesson in my own
// class" and "colleague's upload in my own school". A second school exists so
// the cross-tenant case is tested rather than assumed.
//
// Note that a SELECT that RLS filters out is a 200 with zero rows, not an
// error, so every read probe compares row ids against an expectation rather than
// checking for a failure. An INSERT that is refused does come back as an error.
//
// Run with: node scripts/verify-material-rls.mjs
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

const idsOf = (res) => (res.data ?? []).map((r) => r.id);

/** True when the policy returned exactly the material ids it should have. */
function sawExactly(res, expected, allKnown) {
  const got = idsOf(res);
  if (got.length !== expected.length) {
    return `${got.length} row(s) [${got.join(", ")}], expected ${expected.length} [${expected.join(", ")}]`;
  }
  return got.every((id) => expected.includes(id))
    ? null
    : `rows [${got.join(", ")}] do not match [${expected.join(", ")}] of the ${allKnown} that exist`;
}

const run = async () => {
  const stamp = Date.now();
  const made = { users: [], schools: [] };

  try {
    // --- fixtures ---------------------------------------------------------
    const make = async (name) => {
      const email = `lm-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${stamp}@verify.test`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: name },
      });
      if (error) throw new Error(`createUser ${name}: ${error.message}`);
      made.users.push(data.user.id);
      await admin.from("profiles").upsert({ id: data.user.id, full_name: name });
      return data.user.id;
    };

    const adminUser = await make("Admin");
    const ownerTeacher = await make("Owner Teacher");
    const otherTeacher = await make("Other Teacher");
    const pupilA = await make("Pupil A");
    const pupilB = await make("Pupil B");
    const otherAdmin = await make("Other Admin");

    const createSchool = async (label) => {
      const { data, error } = await admin
        .from("schools")
        .insert({ name: `Materials RLS ${label} ${stamp}`, slug: `lm-rls-${label}-${stamp}` })
        .select("id")
        .single();
      if (error || !data) throw new Error(`school ${label}: ${error?.message ?? "no row"}`);
      made.schools.push(data.id);
      return data.id;
    };

    const schoolId = await createSchool("a");
    const otherSchoolId = await createSchool("b");

    for (const [userId, role, school] of [
      [adminUser, "SCHOOL_ADMIN", schoolId],
      [ownerTeacher, "TEACHER", schoolId],
      [otherTeacher, "TEACHER", schoolId],
      [pupilA, "STUDENT", schoolId],
      [pupilB, "STUDENT", schoolId],
      [otherAdmin, "SCHOOL_ADMIN", otherSchoolId],
    ]) {
      const { error } = await admin
        .from("user_roles")
        .insert({ user_id: userId, school_id: school, role });
      if (error) throw new Error(`role ${role}: ${error.message}`);
    }

    const mkClass = async (school, name, order) => {
      const { data, error } = await admin
        .from("classes")
        .insert({ school_id: school, name, order })
        .select("id")
        .single();
      if (error) throw new Error(`class ${name}: ${error.message}`);
      return data.id;
    };

    const classA = await mkClass(schoolId, "JSS 1 A", 0);
    const classB = await mkClass(schoolId, "JSS 1 B", 1);
    const otherClass = await mkClass(otherSchoolId, "JSS 1 C", 0);

    const mkSubject = async (school) => {
      const { data, error } = await admin
        .from("subjects")
        .insert({ school_id: school, name: `Mathematics ${stamp}`, code: "MTH" })
        .select("id")
        .single();
      if (error) throw new Error(`subject: ${error.message}`);
      return data.id;
    };
    const subjectId = await mkSubject(schoolId);
    const otherSubjectId = await mkSubject(otherSchoolId);

    const mkTeacherRow = async (userId, school) => {
      const { data, error } = await admin
        .from("teachers")
        .insert({ school_id: school, user_id: userId, display_name: "T" })
        .select("id")
        .single();
      if (error) throw new Error(`teachers row: ${error.message}`);
      return data.id;
    };

    const ownerTeacherRow = await mkTeacherRow(ownerTeacher, schoolId);
    const otherTeacherRow = await mkTeacherRow(otherTeacher, schoolId);

    const mkPupilRow = async (userId, klass) => {
      const { data, error } = await admin
        .from("students")
        .insert({
          school_id: schoolId,
          user_id: userId,
          display_name: "P",
          admission_number: `LM-${stamp}-${klass.slice(0, 4)}`,
          class_id: klass,
        })
        .select("id")
        .single();
      if (error) throw new Error(`students row: ${error.message}`);
      return data.id;
    };

    const pupilARow = await mkPupilRow(pupilA, classA);
    const pupilBRow = await mkPupilRow(pupilB, classB);
    if (!pupilARow || !pupilBRow) throw new Error("pupil rows missing");

    const mkCourse = async (school, klass, subject, teacherRow, status) => {
      const { data, error } = await admin
        .from("courses")
        .insert({
          school_id: school,
          class_id: klass,
          subject_id: subject,
          teacher_id: teacherRow,
          title: `Course ${stamp}`,
          status,
        })
        .select("id")
        .single();
      if (error) throw new Error(`course: ${error.message}`);
      return data.id;
    };

    // Class A's course belongs to the owner teacher; class B's to the other one.
    // A draft course and a draft lesson sit alongside the published pair so the
    // pupil side of the policy is tested in all four combinations.
    const courseA = await mkCourse(schoolId, classA, subjectId, ownerTeacherRow, "published");
    const courseB = await mkCourse(schoolId, classB, subjectId, otherTeacherRow, "published");
    const draftCourseA = await mkCourse(schoolId, classA, subjectId, ownerTeacherRow, "draft");
    const otherSchoolCourse = await mkCourse(
      otherSchoolId,
      otherClass,
      otherSubjectId,
      null,
      "published",
    );

    const mkLesson = async (course, status) => {
      const { data, error } = await admin
        .from("lessons")
        .insert({
          school_id: schoolId,
          course_id: course,
          title: `Lesson ${stamp}`,
          status,
        })
        .select("id")
        .single();
      if (error) throw new Error(`lesson: ${error.message}`);
      return data.id;
    };

    const lessonA = await mkLesson(courseA, "published");
    const lessonDraftInOwnClass = await mkLesson(courseA, "draft");
    const lessonB = await mkLesson(courseB, "published");
    const lessonInDraftCourse = await mkLesson(draftCourseA, "published");
    const { data: otherSchoolLesson } = await admin
      .from("lessons")
      .insert({
        school_id: otherSchoolId,
        course_id: otherSchoolCourse,
        title: `Lesson ${stamp}`,
        status: "published",
      })
      .select("id")
      .single();
    if (!otherSchoolLesson) throw new Error("other school lesson: no row");

    // A playback id and a file name are exactly what the old policy leaked, so
    // every fixture carries one. created_by matters: 0005 lets a teacher write
    // their own uploads but not a colleague's, and that test is keyed on
    // created_by rather than on course ownership.
    const mkMaterial = async (lesson, school, label, extra = {}) => {
      const { data, error } = await admin
        .from("lesson_materials")
        .insert({
          school_id: school,
          lesson_id: lesson,
          title: `${label} ${stamp}`,
          file_type: "video",
          file_size: 4096,
          provider: "mux",
          provider_asset_id: `asset-${stamp}-${label}`,
          provider_playback_id: `playback-${stamp}-${label}`,
          duration_seconds: 600,
          storage_path: `${school}/${lesson}/secret-${label}.mp4`,
          created_by: extra.created_by ?? adminUser,
          ...extra,
        })
        .select("id")
        .single();
      if (error) throw new Error(`material ${label}: ${error.message}`);
      return data.id;
    };

    const materialA = await mkMaterial(lessonA, schoolId, "a", { created_by: ownerTeacher });
    const materialDraftLesson = await mkMaterial(lessonDraftInOwnClass, schoolId, "draftlesson", {
      created_by: ownerTeacher,
    });
    const materialB = await mkMaterial(lessonB, schoolId, "b", { created_by: otherTeacher });
    const materialDraftCourse = await mkMaterial(lessonInDraftCourse, schoolId, "draftcourse", {
      created_by: ownerTeacher,
    });
    const materialSoftDeleted = await mkMaterial(lessonA, schoolId, "soft", {
      deleted_at: new Date().toISOString(),
    });
    const materialOtherSchool = await mkMaterial(otherSchoolLesson.id, otherSchoolId, "other");

    // Sanity: the service role really can see all of them, so a passing probe
    // below is the policy working rather than the fixture being empty.
    const allKnown = await admin.from("lesson_materials").select("id").eq("school_id", schoolId);
    check(
      "fixtures exist (service role sees every material in school A)",
      (allKnown.data ?? []).length === 5,
      `saw ${(allKnown.data ?? []).length}, expected 5`,
    );

    const asAdmin = await clientAs(adminUser);
    const asOwner = await clientAs(ownerTeacher);
    const asOther = await clientAs(otherTeacher);
    const asPupilA = await clientAs(pupilA);
    const asPupilB = await clientAs(pupilB);
    const asOtherAdmin = await clientAs(otherAdmin);

    // --- managers ---------------------------------------------------------
    console.log("\nManagers: an unchanged read of their own school");
    const adminVisible = [materialA, materialDraftLesson, materialB, materialDraftCourse];
    const adminRead = await asAdmin.from("lesson_materials").select("id").eq("school_id", schoolId);
    check(
      "school admin reads every live material in the school",
      sawExactly(adminRead, adminVisible, 5) === null,
      sawExactly(adminRead, adminVisible, 5) ?? "",
    );
    check(
      "school admin cannot read a soft-deleted material",
      !idsOf(adminRead).includes(materialSoftDeleted),
      "a removed upload was still readable to a manager",
    );

    const crossSchool = await asAdmin
      .from("lesson_materials")
      .select("id")
      .eq("school_id", otherSchoolId);
    check(
      "school admin cannot read another school's materials",
      !idsOf(crossSchool).includes(materialOtherSchool),
      "a manager crossed a tenant boundary",
    );

    const otherAdminRead = await asOtherAdmin
      .from("lesson_materials")
      .select("id")
      .eq("school_id", schoolId);
    check(
      "a manager in school B reads nothing from school A",
      (otherAdminRead.data ?? []).length === 0,
      `${(otherAdminRead.data ?? []).length} rows leaked across schools`,
    );

    // --- teachers ---------------------------------------------------------
    console.log("\nTeachers: their own uploads, not a colleague's");
    const ownerVisible = [materialA, materialDraftLesson, materialDraftCourse];
    const ownerRead = await asOwner.from("lesson_materials").select("id").eq("school_id", schoolId);
    check(
      "course owner reads every live material on their own courses",
      sawExactly(ownerRead, ownerVisible, 5) === null,
      sawExactly(ownerRead, ownerVisible, 5) ?? "",
    );

    const otherTeacherRead = await asOther
      .from("lesson_materials")
      .select("id")
      .eq("school_id", schoolId);
    check(
      "a teacher reads nothing from a colleague's course",
      sawExactly(otherTeacherRead, [materialB], 5) === null,
      sawExactly(otherTeacherRead, [materialB], 5) ?? "",
    );

    // --- pupils -----------------------------------------------------------
    console.log("\nPupils: their own class, published only");
    const pupilARead = await asPupilA.from("lesson_materials").select("id").eq("school_id", schoolId);
    check(
      "pupil in class A reads their own class's published video",
      sawExactly(pupilARead, [materialA], 5) === null,
      sawExactly(pupilARead, [materialA], 5) ?? "",
    );

    const pupilBRead = await asPupilB.from("lesson_materials").select("id").eq("school_id", schoolId);
    check(
      "pupil in class B cannot read class A's material",
      !idsOf(pupilBRead).includes(materialA),
      "another class's playback id was readable",
    );
    check(
      "pupil in class B reads their own class's video",
      sawExactly(pupilBRead, [materialB], 5) === null,
      sawExactly(pupilBRead, [materialB], 5) ?? "",
    );

    check(
      "pupil cannot read a draft lesson in their own class",
      !idsOf(pupilARead).includes(materialDraftLesson),
      "unpublished lesson material was readable",
    );
    check(
      "pupil cannot read a published lesson in a draft course",
      !idsOf(pupilARead).includes(materialDraftCourse),
      "material in an unpublished course was readable",
    );
    check(
      "pupil cannot read a soft-deleted material",
      !idsOf(pupilARead).includes(materialSoftDeleted),
      "a removed upload was still readable",
    );

    const pupilCrossSchool = await asPupilA
      .from("lesson_materials")
      .select("id")
      .eq("school_id", otherSchoolId);
    check(
      "pupil cannot read another school's material",
      (pupilCrossSchool.data ?? []).length === 0,
      `${(pupilCrossSchool.data ?? []).length} rows leaked across schools`,
    );

    // --- the leak that motivated this, stated as its own probe -----------
    console.log("\nThe specific leak: playback ids across classes");
    const leakProbe = await asPupilB
      .from("lesson_materials")
      .select("title, provider_playback_id, storage_path")
      .eq("lesson_id", lessonA);
    check(
      "pupil in class B selects zero rows on class A's lesson",
      (leakProbe.data ?? []).length === 0,
      `row returned: ${JSON.stringify(leakProbe.data?.[0] ?? null)}`,
    );

    // --- writes -----------------------------------------------------------
    console.log("\nWrites: pupils and teachers who do not own the material");
    const pupilInsert = await asPupilA.from("lesson_materials").insert({
      school_id: schoolId,
      lesson_id: lessonA,
      title: `Sneaky ${stamp}`,
      file_type: "video",
    });
    check(
      "database refuses a pupil adding a material",
      !!pupilInsert.error,
      "a pupil created an upload row",
    );

    const pupilUpdate = await asPupilA
      .from("lesson_materials")
      .update({ title: `Renamed ${stamp}` })
      .eq("id", materialA)
      .select("id");
    check(
      "database refuses a pupil renaming a material",
      !idsOf(pupilUpdate).includes(materialA),
      "a pupil edited a material they should not see",
    );

    const otherTeacherUpdate = await asOther
      .from("lesson_materials")
      .update({ title: `Renamed ${stamp}` })
      .eq("id", materialA)
      .select("id");
    check(
      "database refuses a teacher renaming a colleague's material",
      !idsOf(otherTeacherUpdate).includes(materialA),
      "a teacher edited another teacher's upload",
    );

    const ownerUpdate = await asOwner
      .from("lesson_materials")
      .update({ title: `Renamed ${stamp}` })
      .eq("id", materialA)
      .select("id");
    check(
      "the course owner can still rename their own material",
      idsOf(ownerUpdate).includes(materialA),
      "0023 broke the upload flow the policy is meant to protect",
    );

    // --- the helper the policy leans on ----------------------------------
    console.log("\nThe helper: is_own_course()");
    const selfOwn = await asOwner.rpc("is_own_course", {
      p_school_id: schoolId,
      p_course_id: courseA,
    });
    const selfOther = await asOwner.rpc("is_own_course", {
      p_school_id: schoolId,
      p_course_id: courseB,
    });
    check("is_own_course() says yes for the teacher's own course", selfOwn.data === true);
    check(
      "is_own_course() says no for a course they do not own",
      selfOther.data === false,
      `got ${JSON.stringify(selfOther.data ?? selfOther.error?.message)}`,
    );
  } catch (err) {
    failed++;
    console.log(`  FAIL  harness error: ${err?.message ?? err}`);
    if (err?.stack) console.log(err.stack);
  } finally {
    // Materials, lessons and courses cascade from the school, so deleting the
    // school is enough; only the users need clearing first, because auth.users
    // is not owned by the school.
    for (const userId of made.users) {
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("students").delete().eq("user_id", userId);
      await admin.from("teachers").delete().eq("user_id", userId);
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
    for (const school of made.schools) {
      await admin.from("schools").delete().eq("id", school);
    }

    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
  }
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});