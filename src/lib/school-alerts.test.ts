import { describe, expect, it } from "vitest";
import {
  computeDecliningStudents,
  computeInactiveStudents,
  computeLowSubjects,
  INACTIVE_AFTER_DAYS,
} from "./school-alerts";

const NOW = new Date("2026-06-15T12:00:00.000Z");

function history(
  studentId: string,
  percentages: number[],
  extra: Partial<{ displayName: string; className: string | null }> = {},
) {
  return {
    studentId,
    displayName: extra.displayName ?? studentId,
    className: extra.className ?? null,
    percentages,
  };
}

describe("computeDecliningStudents", () => {
  it("flags a clear fall and reports the change", () => {
    // recent [50,50,50] = 50, previous [80,80,80] = 80 → −30
    const result = computeDecliningStudents([history("a", [50, 50, 50, 80, 80, 80])]);
    expect(result).toHaveLength(1);
    expect(result[0].recentAverage).toBe(50);
    expect(result[0].previousAverage).toBe(80);
    expect(result[0].change).toBe(-30);
  });

  it("does not flag a small dip below the threshold", () => {
    // 78 vs 80 → −2
    expect(computeDecliningStudents([history("a", [78, 78, 78, 80, 80, 80])])).toHaveLength(0);
  });

  it("does not flag an improvement", () => {
    expect(computeDecliningStudents([history("a", [90, 90, 90, 60, 60, 60])])).toHaveLength(0);
  });

  it("needs enough results on both sides", () => {
    // Only three results: no previous window at all.
    expect(computeDecliningStudents([history("a", [10, 20, 30])])).toHaveLength(0);
    // One previous value is below the minimum.
    expect(computeDecliningStudents([history("a", [10, 10, 10, 90])])).toHaveLength(0);
  });

  it("sorts the steepest decline first", () => {
    const result = computeDecliningStudents([
      history("a", [60, 60, 60, 80, 80, 80]), // −20
      history("b", [30, 30, 30, 90, 90, 90]), // −60
    ]);
    expect(result.map((s) => s.studentId)).toEqual(["b", "a"]);
  });
});

describe("computeInactiveStudents", () => {
  const student = (
    studentId: string,
    lastActiveAt: string | null,
    createdAt = "2026-01-01T00:00:00.000Z",
  ) => ({ studentId, displayName: studentId, className: null, createdAt, lastActiveAt });

  it("flags a student quiet for the threshold or longer", () => {
    const result = computeInactiveStudents(
      [student("a", "2026-05-01T00:00:00.000Z")], // 45 days
      NOW,
    );
    expect(result).toHaveLength(1);
    expect(result[0].daysInactive).toBe(45);
    expect(result[0].neverActive).toBe(false);
  });

  it("keeps a recently active student off the list", () => {
    expect(computeInactiveStudents([student("a", "2026-06-10T00:00:00.000Z")], NOW)).toHaveLength(0);
  });

  it("flags a never-active student only after they are old enough", () => {
    const old = student("a", null, "2026-01-01T00:00:00.000Z");
    const fresh = student("b", null, "2026-06-10T00:00:00.000Z");
    const result = computeInactiveStudents([old, fresh], NOW);
    expect(result.map((s) => s.studentId)).toEqual(["a"]);
    expect(result[0].neverActive).toBe(true);
  });

  it("sorts the quietest first", () => {
    const result = computeInactiveStudents(
      [
        student("a", "2026-05-01T00:00:00.000Z"), // 45 days
        student("b", "2026-03-01T00:00:00.000Z"), // 106 days
      ],
      NOW,
    );
    expect(result.map((s) => s.studentId)).toEqual(["b", "a"]);
  });

  it("uses the configured threshold", () => {
    const result = computeInactiveStudents([student("a", "2026-06-10T00:00:00.000Z")], NOW, {
      afterDays: 3,
    });
    expect(result).toHaveLength(1);
  });

  it("exposes a sane default threshold", () => {
    expect(INACTIVE_AFTER_DAYS).toBe(30);
  });
});

describe("computeLowSubjects", () => {
  const subject = (subjectId: string, average: number, results: number) => ({
    subjectId,
    subjectName: subjectId,
    average,
    results,
  });

  it("flags subjects below the threshold with enough results", () => {
    const result = computeLowSubjects([subject("math", 42, 10), subject("art", 70, 10)]);
    expect(result.map((s) => s.subjectId)).toEqual(["math"]);
  });

  it("ignores a low subject without enough results", () => {
    expect(computeLowSubjects([subject("math", 20, 2)])).toHaveLength(0);
  });

  it("orders the weakest first", () => {
    const result = computeLowSubjects([
      subject("math", 45, 8),
      subject("physics", 30, 8),
    ]);
    expect(result.map((s) => s.subjectId)).toEqual(["physics", "math"]);
  });
});
