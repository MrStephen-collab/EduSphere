import { describe, expect, it } from "vitest";
import { studentMayAccessCourse } from "@/services/material-storage";

/**
 * The cross-class rule is the only thing standing between a student in one class
 * and another class's lesson content, so it is pinned here. The live data backs
 * this up: David sits in SS 2 while a second course belongs to SS 1.
 *
 * Streams are deliberately not part of this rule. The live schema has
 * `students.stream_id` but no `courses.stream_id`, so a course cannot be
 * narrowed to a stream and a student is never denied by stream alone.
 */

const SS1 = "c5bf9685-0000-4000-8000-000000000000";
const SS2 = "923cc351-0000-4000-8000-000000000000";

describe("studentMayAccessCourse", () => {
  it("allows a student in the course's own class", () => {
    expect(studentMayAccessCourse({ classId: SS2 }, { classId: SS2 })).toBe(true);
  });

  it("denies a student in a different class", () => {
    // The case that matters: SS 2 student, SS 1 course.
    expect(studentMayAccessCourse({ classId: SS2 }, { classId: SS1 })).toBe(false);
  });

  it("denies a student whose class is unset", () => {
    expect(studentMayAccessCourse({ classId: null }, { classId: SS2 })).toBe(false);
  });

  it("denies when the course has no class", () => {
    expect(studentMayAccessCourse({ classId: SS2 }, { classId: null })).toBe(false);
  });

  it("denies when both sides are unset", () => {
    // Guards against two unassigned records matching each other.
    expect(studentMayAccessCourse({ classId: null }, { classId: null })).toBe(false);
  });

  it("ignores a student's stream, which never narrows class access", () => {
    // students.stream_id is not mirrored on courses, so a student assigned to
    // one stream must still reach their own class's course.
    expect(studentMayAccessCourse({ classId: SS2 }, { classId: SS2 })).toBe(true);
  });
});
