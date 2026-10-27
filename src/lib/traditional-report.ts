// ---------------------------------------------------------------------------
// Traditional report card — shared shape, defaults and small helpers.
//
// This is the paper-style "End of Term Report Sheet" that a school fills in by
// hand (or types in) rather than the analytics-computed report card in
// `src/services/report-cards.ts`. The same shape is used by:
//   * the printable component  → src/components/report/traditional/
//   * the entry form           → traditional-report-card-entry.tsx
//   * the persistence service  → src/services/traditional-report-cards.ts
// so a saved card can be rendered back exactly as it was entered.
// ---------------------------------------------------------------------------

export type TraditionalGrade = "A" | "B" | "C" | "D" | "E";

export type TraditionalTraitRow = {
  name: string;
  value?: TraditionalGrade | null;
};

export type TraditionalSubjectRow = {
  name: string;
  test1?: number | null;
  test2?: number | null;
  test3?: number | null;
  totalTests?: number | null;
  exam?: number | null;
  overall?: number | null;
  lastTerm?: number | null;
  cumulative?: number | null;
  classAvg?: number | null;
  position?: number | null;
  grade?: string | null;
  remark?: string | null;
  teacherSignature?: string | null;
};

export type TraditionalComments = {
  classTeacher?: string | null;
  classTeacherName?: string | null;
  classTeacherDate?: string | null;
  principal?: string | null;
  principalName?: string | null;
  principalDate?: string | null;
  nextTermBegins?: string | null;
};

export type TraditionalReportData = {
  school: {
    name: string;
    address?: string | null;
    phone?: string | null;
    logoUrl?: string | null;
    motto?: string | null;
  };
  student: {
    fullName: string;
    admissionNo: string;
    className: string;
    sex?: string | null;
    house?: string | null;
    session: string;
    term: string;
    photoUrl?: string | null;
    noOnRoll?: number | null;
    position?: number | null;
    totalInClass?: number | null;
    daysOpened?: number | null;
    daysPresent?: number | null;
    daysAbsent?: number | null;
  };
  subjects: TraditionalSubjectRow[];
  affective: TraditionalTraitRow[];
  psychomotor: TraditionalTraitRow[];
  comments: TraditionalComments;
  stampUrl?: string | null;
};

/**
 * Subject list used when a school has not configured any of its own. Kept in
 * sync with the printed template so an unconfigured school still gets a
 * usable sheet.
 */
export const TRADITIONAL_DEFAULT_SUBJECTS = [
  "English Language",
  "Dictation",
  "Mathematics",
  "Basic Science & Technology",
  "Pre-Vocational Studies",
  "Business Studies",
  "Religion & National Values 1",
  "Religion & National Values 2",
  "Creative & Cultural Art",
  "Civic Education",
  "Animal Husbandry",
  "Computer Studies",
  "Chemistry",
  "Geography",
  "Further Mathematics",
  "Biology",
  "Physics",
  "Agricultural Science",
  "Economics",
  "History",
  "Government",
  "Christian Religious Studies",
  "Music (GNS)",
  "Yoruba",
] as const;

export const TRADITIONAL_AFFECTIVE = [
  "Punctuality",
  "Attentiveness",
  "Honesty",
  "Leadership",
  "Helping Others",
  "Emotional Stability",
  "Health",
  "Attitude to School Work",
] as const;

export const TRADITIONAL_PSYCHOMOTOR = [
  "Verbal Fluency",
  "Musical Skills",
  "Sports",
  "Drawing & Painting",
  "Handling Tools",
  "Hand Work",
  "Versatility",
] as const;

export function emptySubject(name: string): TraditionalSubjectRow {
  return {
    name,
    test1: null,
    test2: null,
    test3: null,
    totalTests: null,
    exam: null,
    overall: null,
    lastTerm: null,
    cumulative: null,
    classAvg: null,
    position: null,
    grade: null,
    remark: null,
  };
}

export function blankComments(): TraditionalComments {
  return {
    classTeacher: "",
    classTeacherName: "",
    classTeacherDate: "",
    principal: "",
    principalName: "",
    principalDate: "",
    nextTermBegins: "",
  };
}

export function defaultAffective(): TraditionalTraitRow[] {
  return TRADITIONAL_AFFECTIVE.map((name) => ({ name, value: null }));
}

export function defaultPsychomotor(): TraditionalTraitRow[] {
  return TRADITIONAL_PSYCHOMOTOR.map((name) => ({ name, value: null }));
}

/** Parse a numeric input, treating a blank string as "not entered". */
export function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function sumEntered(...values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => typeof v === "number");
  if (valid.length === 0) return null;
  return valid.reduce((total, value) => total + value, 0);
}

/**
 * Recompute derived columns after a test or exam score changes.
 * `totalTests` is the sum of Test 1–3; `overall` is total tests + exam. Both
 * stay blank until at least one component has been entered, so an empty row
 * never shows a misleading 0.
 */
export function recalculateSubject(row: TraditionalSubjectRow): TraditionalSubjectRow {
  const totalTests = sumEntered(row.test1, row.test2, row.test3);
  const overall =
    totalTests == null && row.exam == null
      ? null
      : sumEntered(totalTests, row.exam);
  return { ...row, totalTests, overall };
}
