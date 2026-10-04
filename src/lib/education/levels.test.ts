import { describe, expect, it } from "vitest";
import {
  DEFAULT_EDUCATION_LEVEL,
  EDUCATION_LEVELS,
  HIGHER_EDUCATION_LEVELS,
  buildClassSuggestions,
  getLevelDefinition,
  isEducationLevel,
  levelOffersCourses,
  levelUsesDepartments,
} from "@/lib/education/levels";
import type { EducationLevel } from "@/types/database";

describe("education levels", () => {
  it("resolves every declared level to a definition", () => {
    for (const level of EDUCATION_LEVELS) {
      expect(getLevelDefinition(level.value).value).toBe(level.value);
    }
  });

  it("falls back to secondary for a missing or unknown level", () => {
    const misspelt = "polythechnic" as unknown as EducationLevel;
    expect(getLevelDefinition(null).value).toBe(DEFAULT_EDUCATION_LEVEL);
    expect(getLevelDefinition(misspelt).value).toBe(DEFAULT_EDUCATION_LEVEL);
    expect(isEducationLevel("polythechnic")).toBe(false);
    expect(isEducationLevel("university")).toBe(true);
  });
});

describe("levelOffersCourses", () => {
  it("offers courses at every higher-education level", () => {
    for (const level of HIGHER_EDUCATION_LEVELS) {
      expect(levelOffersCourses(level)).toBe(true);
    }
  });

  it("does not offer courses below higher education", () => {
    for (const level of ["nursery", "primary", "secondary"] as const) {
      expect(levelOffersCourses(level)).toBe(false);
    }
  });

  it("treats an undeclared level as secondary, so no courses", () => {
    expect(levelOffersCourses(null)).toBe(false);
    expect(levelOffersCourses(undefined)).toBe(false);
  });
});

describe("levelUsesDepartments", () => {
  it("is true only where classes are grouped under a department", () => {
    expect(levelUsesDepartments("college")).toBe(true);
    expect(levelUsesDepartments("polytechnic")).toBe(true);
    expect(levelUsesDepartments("university")).toBe(true);
    expect(levelUsesDepartments("primary")).toBe(false);
    expect(levelUsesDepartments("secondary")).toBe(false);
  });
});

describe("buildClassSuggestions", () => {
  it("suggests JSS and SS classes for a secondary school", () => {
    expect(buildClassSuggestions("secondary").map((c) => c.name)).toEqual([
      "JSS 1",
      "JSS 2",
      "JSS 3",
      "SS 1",
      "SS 2",
      "SS 3",
    ]);
  });

  it("qualifies polytechnic years by programme and department", () => {
    const suggestions = buildClassSuggestions("polytechnic", [
      { id: "d1", name: "Computer Science" },
    ]);
    expect(suggestions).toHaveLength(4);
    expect(suggestions[0]).toMatchObject({
      name: "Computer Science OND Year 1",
      departmentId: "d1",
      programme: "OND",
    });
  });

  it("leaves departmentId null when the school has no departments yet", () => {
    const suggestions = buildClassSuggestions("college");
    expect(suggestions.every((c) => c.departmentId === null)).toBe(true);
    expect(suggestions.map((c) => c.name)).toEqual(["Year 1", "Year 2", "Year 3"]);
  });
});