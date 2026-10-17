// The "important alerts" a school administrator should see first (spec
// section 34):
//
//   * students whose performance is declining
//   * assignments still awaiting marking
//   * examinations coming up
//   * students who have gone quiet
//   * subjects doing badly
//
// The judgement calls live here as pure functions so they can be tested and so
// the thresholds are in one obvious place. The service does the querying; this
// module only decides what counts as worth flagging.
//
// Honesty notes that keep the lists useful rather than noisy:
//   * A decline is only claimed with enough results on both sides of the
//     comparison, so one recent bad test does not flag a student.
//   * A student with no activity at all is only "inactive" if they have been
//     enrolled long enough for that to mean something; brand-new accounts are
//     left alone.
//   * A subject is only "low-performing" with a minimum number of results, so a
//     single failed paper does not label it.

export const DECLINE_THRESHOLD = 10;
/** Results compared on each side of a decline check. */
export const DECLINE_WINDOW = 3;
/** Minimum results needed on each side before a decline is claimed. */
export const DECLINE_MIN_PER_WINDOW = 2;

export const INACTIVE_AFTER_DAYS = 30;
export const UPCOMING_EXAM_DAYS = 14;

export const LOW_SUBJECT_THRESHOLD = 50;
export const LOW_SUBJECT_MIN_RESULTS = 5;

const MS_PER_DAY = 86_400_000;

export type StudentHistory = {
  studentId: string;
  displayName: string;
  className: string | null;
  /** Percentages, most recent first. */
  percentages: number[];
};

export type DecliningStudent = {
  studentId: string;
  displayName: string;
  className: string | null;
  recentAverage: number;
  previousAverage: number;
  /** recentAverage − previousAverage (negative means a decline). */
  change: number;
};

function averageOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Flags students whose latest results are meaningfully below their previous
 * ones. Both windows need `DECLINE_MIN_PER_WINDOW` results or the student is
 * left out (there is not enough to judge).
 */
export function computeDecliningStudents(
  histories: StudentHistory[],
  {
    window = DECLINE_WINDOW,
    minPerWindow = DECLINE_MIN_PER_WINDOW,
    threshold = DECLINE_THRESHOLD,
  }: { window?: number; minPerWindow?: number; threshold?: number } = {},
): DecliningStudent[] {
  const declining: DecliningStudent[] = [];

  for (const history of histories) {
    const recent = history.percentages.slice(0, window);
    const previous = history.percentages.slice(window, window * 2);
    if (recent.length < minPerWindow || previous.length < minPerWindow) continue;

    const recentAvg = averageOf(recent);
    const previousAvg = averageOf(previous);
    if (recentAvg == null || previousAvg == null) continue;

    const change = recentAvg - previousAvg;
    if (change < -threshold) {
      declining.push({
        studentId: history.studentId,
        displayName: history.displayName,
        className: history.className,
        recentAverage: Math.round(recentAvg),
        previousAverage: Math.round(previousAvg),
        change: Math.round(change),
      });
    }
  }

  // Biggest fall first — the most urgent to look at.
  return declining.sort((a, b) => a.change - b.change);
}

export type StudentActivity = {
  studentId: string;
  displayName: string;
  className: string | null;
  /** When the student account was created (ISO). */
  createdAt: string;
  /** When the student was last seen (ISO), or null if never. */
  lastActiveAt: string | null;
};

export type InactiveStudent = {
  studentId: string;
  displayName: string;
  className: string | null;
  lastActiveAt: string | null;
  /** Whole days since last activity, or since enrolment if never active. */
  daysInactive: number;
  /** True when the student has never been active at all. */
  neverActive: boolean;
};

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/**
 * Flags students quiet for `INACTIVE_AFTER_DAYS`+. A student who has never
 * been active is only flagged once they have been enrolled that long, so a
 * fresh account is not held against them.
 */
export function computeInactiveStudents(
  students: StudentActivity[],
  now: Date = new Date(),
  { afterDays = INACTIVE_AFTER_DAYS }: { afterDays?: number } = {},
): InactiveStudent[] {
  const inactive: InactiveStudent[] = [];

  for (const student of students) {
    if (student.lastActiveAt) {
      const last = new Date(student.lastActiveAt);
      if (Number.isNaN(last.getTime())) continue;
      const days = daysBetween(last, now);
      if (days >= afterDays) {
        inactive.push({
          studentId: student.studentId,
          displayName: student.displayName,
          className: student.className,
          lastActiveAt: student.lastActiveAt,
          daysInactive: days,
          neverActive: false,
        });
      }
      continue;
    }

    const created = new Date(student.createdAt);
    if (Number.isNaN(created.getTime())) continue;
    const days = daysBetween(created, now);
    if (days >= afterDays) {
      inactive.push({
        studentId: student.studentId,
        displayName: student.displayName,
        className: student.className,
        lastActiveAt: null,
        daysInactive: days,
        neverActive: true,
      });
    }
  }

  // Longest quiet first.
  return inactive.sort((a, b) => b.daysInactive - a.daysInactive);
}

export type SubjectAverageInput = {
  subjectId: string;
  subjectName: string;
  average: number;
  results: number;
};

export type LowSubject = SubjectAverageInput;

/**
 * Subjects averaging below the pass mark, once they have enough results to be
 * worth naming. Lowest first.
 */
export function computeLowSubjects(
  subjects: SubjectAverageInput[],
  {
    threshold = LOW_SUBJECT_THRESHOLD,
    minResults = LOW_SUBJECT_MIN_RESULTS,
  }: { threshold?: number; minResults?: number } = {},
): LowSubject[] {
  return subjects
    .filter((s) => s.results >= minResults && s.average < threshold)
    .sort((a, b) => a.average - b.average);
}
