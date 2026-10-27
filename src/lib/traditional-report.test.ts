import { describe, expect, it } from "vitest";
import {
  classTeacherEditsEverySubject,
  emptySubject,
  mergeSubjectsForEditor,
  recalculateSubject,
  subjectKey,
  toNumberOrNull,
} from "@/lib/traditional-report";

describe("toNumberOrNull", () => {
  it("treats a blank field as not entered rather than zero", () => {
    expect(toNumberOrNull("")).toBeNull();
    expect(toNumberOrNull("   ")).toBeNull();
  });

  it("parses numbers and rejects junk", () => {
    expect(toNumberOrNull("18")).toBe(18);
    expect(toNumberOrNull("12.5")).toBe(12.5);
    expect(toNumberOrNull("nope")).toBeNull();
  });
});

describe("recalculateSubject", () => {
  it("keeps an empty row blank instead of showing zero", () => {
    const row = recalculateSubject(emptySubject("Mathematics"));
    expect(row.totalTests).toBeNull();
    expect(row.overall).toBeNull();
  });

  it("adds the three tests and then the exam", () => {
    const row = recalculateSubject({
      ...emptySubject("English Language"),
      test1: 18,
      test2: 17,
      test3: 16,
      exam: 48,
    });
    expect(row.totalTests).toBe(51);
    expect(row.overall).toBe(99);
  });

  it("still computes a total when only some tests are entered", () => {
    const row = recalculateSubject({
      ...emptySubject("Biology"),
      test1: 10,
      exam: 40,
    });
    expect(row.totalTests).toBe(10);
    expect(row.overall).toBe(50);
  });

  it("computes overall from the exam alone", () => {
    const row = recalculateSubject({
      ...emptySubject("Chemistry"),
      exam: 55,
    });
    expect(row.totalTests).toBeNull();
    expect(row.overall).toBe(55);
  });

  it("leaves unrelated columns untouched", () => {
    const row = recalculateSubject({
      ...emptySubject("Physics"),
      test1: 5,
      lastTerm: 70,
      grade: "A",
    });
    expect(row.lastTerm).toBe(70);
    expect(row.grade).toBe("A");
  });
});

describe("classTeacherEditsEverySubject", () => {
  it("gives a primary class teacher every subject", () => {
    expect(classTeacherEditsEverySubject("primary", true)).toBe(true);
  });

  it("gives a nursery class teacher every subject", () => {
    expect(classTeacherEditsEverySubject("nursery", true)).toBe(true);
  });

  it("keeps a secondary class teacher to their own subjects", () => {
    expect(classTeacherEditsEverySubject("secondary", true)).toBe(false);
  });

  it("does not give a subject teacher every subject at any level", () => {
    expect(classTeacherEditsEverySubject("primary", false)).toBe(false);
    expect(classTeacherEditsEverySubject("secondary", false)).toBe(false);
  });

  it("treats an unset level as secondary", () => {
    expect(classTeacherEditsEverySubject(null, true)).toBe(false);
  });
});

describe("subjectKey", () => {  it("ignores case and surrounding whitespace", () => {
    expect(subjectKey("  Mathematics ")).toBe(subjectKey("mathematics"));
  });
});

describe("mergeSubjectsForEditor", () => {
  const existing = [
    { ...emptySubject("English Language"), test1: 12, exam: 40, overall: 52 },
    { ...emptySubject("Mathematics"), test1: 9, exam: 35, overall: 44 },
    { ...emptySubject("Physics"), test1: 7, exam: 30, overall: 37 },
  ];

  it("replaces only the editor's own rows and keeps everyone else untouched", () => {
    const submitted = existing.map((row) =>
      row.name === "Physics"
        ? { ...row, test1: 20, exam: 50, totalTests: 20, overall: 70 }
        : { ...row, test1: 99, exam: 99, totalTests: 99, overall: 99 },
    );

    const merged = mergeSubjectsForEditor(existing, submitted, ["Physics"]);

    expect(merged.find((row) => row.name === "Physics")?.overall).toBe(70);
    expect(merged.find((row) => row.name === "English Language")?.overall).toBe(52);
    expect(merged.find((row) => row.name === "Mathematics")?.overall).toBe(44);
  });

  it("never adds a subject the editor does not teach", () => {
    const submitted = [...existing, emptySubject("Chemistry")];
    const merged = mergeSubjectsForEditor(existing, submitted, ["Physics"]);
    expect(merged.some((row) => row.name === "Chemistry")).toBe(false);
  });

  it("adds a missing own subject", () => {
    const remaining = existing.filter((row) => row.name !== "Physics");
    const submitted = [
      ...remaining,
      { ...emptySubject("Physics"), test1: 18 },
    ];
    const merged = mergeSubjectsForEditor(remaining, submitted, ["physics"]);
    expect(merged.find((row) => row.name === "Physics")?.test1).toBe(18);
  });

  it("allows an editor to remove a row for their own subject", () => {
    const submitted = existing.filter((row) => row.name !== "Physics");
    const merged = mergeSubjectsForEditor(existing, submitted, ["Physics"]);
    expect(merged.some((row) => row.name === "Physics")).toBe(false);
    expect(merged).toHaveLength(2);
  });

  it("keeps every existing row when the editor has no subjects", () => {
    const merged = mergeSubjectsForEditor(existing, [], []);
    expect(merged).toEqual(existing);
  });

  it("takes the submission as-is when all subjects are editable", () => {
    const submitted = [emptySubject("Only Subject")];
    expect(mergeSubjectsForEditor(existing, submitted, null)).toBe(submitted);
  });

  it("does not duplicate a row when names differ only in case", () => {
    const submitted = [{ ...emptySubject(" physics "), test1: 15 }];
    const merged = mergeSubjectsForEditor(existing, submitted, ["Physics"]);
    expect(merged.filter((row) => subjectKey(row.name) === "physics")).toHaveLength(1);
    expect(merged.find((row) => subjectKey(row.name) === "physics")?.test1).toBe(15);
  });
});
