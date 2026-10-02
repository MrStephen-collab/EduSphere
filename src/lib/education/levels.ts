import type { Department, EducationLevel } from "@/types/database";

/**
 * What each education level calls things, and what a class is called there.
 *
 * This is the whole of the vocabulary change. Before it existed, "class" was
 * whatever an admin typed into a free-text box and the only trace of a naming
 * convention anywhere was a hardcoded array in the onboarding wizard. Now the
 * convention lives here, in one place, and is derived from the level a school
 * declares.
 *
 * A school with no declared level falls back to secondary, which is what the
 * onboarding wizard has always suggested and what the seeded school is.
 */
export type LevelDefinition = {
  value: EducationLevel;
  label: string;
  /** Noun for the entity a teacher teaches into. */
  classNoun: string;
  pluralClassNoun: string;
  /**
   * Noun for the grouping layer, or null when the level has none. University
   * calls its departments faculties; that is a naming difference, not a
   * structural one, so both use the departments table.
   */
  groupNoun: string | null;
  /** Programmes a class can sit in. Only polytechnic has these. */
  programmes: readonly string[];
  description: string;
};

export const EDUCATION_LEVELS: readonly LevelDefinition[] = [
  {
    value: "nursery",
    label: "Nursery",
    classNoun: "Class",
    pluralClassNoun: "Classes",
    groupNoun: null,
    programmes: [],
    description: "Early years, usually ages two to five.",
  },
  {
    value: "primary",
    label: "Primary",
    classNoun: "Year",
    pluralClassNoun: "Years",
    groupNoun: null,
    programmes: [],
    description: "Primary school, Year 1 to Year 6.",
  },
  {
    value: "secondary",
    label: "Secondary",
    classNoun: "Class",
    pluralClassNoun: "Classes",
    groupNoun: null,
    programmes: [],
    description: "Junior and senior secondary, JSS 1 to SS 3.",
  },
  {
    value: "college",
    label: "College",
    classNoun: "Year",
    pluralClassNoun: "Years",
    groupNoun: "Department",
    programmes: [],
    description: "Post-secondary, courses grouped by department.",
  },
  {
    value: "polytechnic",
    label: "Polytechnic",
    classNoun: "Year",
    pluralClassNoun: "Years",
    groupNoun: "Department",
    programmes: ["OND", "HND"],
    description: "Polytechnic, OND and HND years inside a department.",
  },
  {
    value: "university",
    label: "University",
    classNoun: "Level",
    pluralClassNoun: "Levels",
    groupNoun: "Faculty",
    programmes: [],
    description: "University, courses grouped by faculty.",
  },
] as const;

export const DEFAULT_EDUCATION_LEVEL: EducationLevel = "secondary";

export function isEducationLevel(value: unknown): value is EducationLevel {
  return (
    typeof value === "string" &&
    EDUCATION_LEVELS.some((level) => level.value === value)
  );
}

export function getLevelDefinition(
  level: EducationLevel | null | undefined,
): LevelDefinition {
  const resolved = isEducationLevel(level) ? level : DEFAULT_EDUCATION_LEVEL;
  // Every enum value is present in EDUCATION_LEVELS, and DEFAULT is one of
  // them, so this lookup cannot miss.
  return (
    EDUCATION_LEVELS.find((candidate) => candidate.value === resolved) ??
    EDUCATION_LEVELS.find(
      (candidate) => candidate.value === DEFAULT_EDUCATION_LEVEL,
    )!
  );
}

/** True when courses and classes at this level are grouped under a department. */
export function levelUsesDepartments(
  level: EducationLevel | null | undefined,
): boolean {
  return getLevelDefinition(level).groupNoun !== null;
}

/**
 * A class the platform suggests creating, before the school renames it.
 *
 * `departmentId` and `programme` are null for the levels that have neither.
 */
export type ClassSuggestion = {
  name: string;
  departmentId: string | null;
  departmentName: string | null;
  programme: string | null;
};

const range = (prefix: string, start: number, end: number): string[] => {
  const out: string[] = [];
  for (let n = start; n <= end; n += 1) out.push(`${prefix} ${n}`);
  return out;
};

/**
 * The class names a school of this level would conventionally have.
 *
 * Used to seed a new school and to show an admin what this level looks like
 * before they override anything. Every name stays editable: this is a starting
 * point, not a constraint, so a school that calls its classes "Sets" can.
 */
export function buildClassSuggestions(
  level: EducationLevel | null | undefined,
  departments: Pick<Department, "id" | "name">[] = [],
): ClassSuggestion[] {
  const definition = getLevelDefinition(level);
  const plain = (names: string[]): ClassSuggestion[] =>
    names.map((name) => ({
      name,
      departmentId: null,
      departmentName: null,
      programme: null,
    }));

  switch (definition.value) {
    case "nursery":
      return plain(range("Nursery", 1, 3));
    case "primary":
      return plain(range("Year", 1, 6));
    case "secondary":
      return plain([...range("JSS", 1, 3), ...range("SS", 1, 3)]);
    case "college":
      // Without departments yet there is nothing to qualify, so the years stand
      // on their own until the school adds its departments.
      if (departments.length === 0) return plain(range("Year", 1, 3));
      return departments.flatMap((department) =>
        range("Year", 1, 3).map((name) => ({
          name: `${department.name} ${name}`,
          departmentId: department.id,
          departmentName: department.name,
          programme: null,
        })),
      );
    case "polytechnic":
      // OND and HND are different programmes, not different years of one, so
      // both are generated under every department.
      if (departments.length === 0) {
        return definition.programmes.flatMap((programme) =>
          range("Year", 1, 2).map((name) => ({
            name: `${programme} ${name}`,
            departmentId: null,
            departmentName: null,
            programme,
          })),
        );
      }
      return departments.flatMap((department) =>
        definition.programmes.flatMap((programme) =>
          range("Year", 1, 2).map((name) => ({
            name: `${department.name} ${programme} ${name}`,
            departmentId: department.id,
            departmentName: department.name,
            programme,
          })),
        ),
      );
    case "university": {
      if (departments.length === 0) {
        return plain(["Level 100", "Level 200", "Level 300", "Level 400"]);
      }
      return departments.flatMap((department) =>
        [100, 200, 300, 400].map((level) => ({
          name: `${department.name} Level ${level}`,
          departmentId: department.id,
          departmentName: department.name,
          programme: null,
        })),
      );
    }
  }
}

/**
 * Names offered when creating a class, combining this level's convention with
 * the school's own departments.
 */
export function classNameOptions(
  level: EducationLevel | null | undefined,
  departments: Pick<Department, "id" | "name">[],
): ClassSuggestion[] {
  return buildClassSuggestions(level, departments);
}