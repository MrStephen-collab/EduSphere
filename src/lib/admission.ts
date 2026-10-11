// Pure helpers for online admission.
//
// This module imports nothing but a type, so the reference-number format and
// the workflow rules can be unit-tested without a database or a session. The
// service layer does the I/O and calls into here for every value it persists or
// displays.

import type { AdmissionStatus } from "@/types/database";

/** Every application reference starts with this, so it is recognisable. */
export const APPLICATION_NUMBER_PREFIX = "ADM-";

/**
 * A stable reference from an arbitrary seed.
 *
 * The application id is a uuid by the time this is called, so the first eight
 * hex characters of it are short, unique enough within one school, and
 * human-quotable over the phone -- unlike the full 32-character uuid. Seeded
 * rather than random so the format is testable.
 */
export function applicationNumberFromSeed(seed: string): string {
  const cleaned = seed.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `${APPLICATION_NUMBER_PREFIX}${cleaned.slice(0, 8).padStart(8, "0")}`;
}

/** A fresh application reference for a public submission. */
export function buildApplicationNumber(): string {
  return applicationNumberFromSeed(crypto.randomUUID().replace(/-/g, ""));
}

/**
 * The happy path, in order. `rejected` and `withdrawn` hang off it rather than
 * sitting inside it, because they are exits and not steps.
 */
export const ADMISSION_STATUS_FLOW = [
  "submitted",
  "under_review",
  "entrance",
  "offered",
  "enrolled",
] as const satisfies readonly AdmissionStatus[];

/** Once an application is here, the workflow is done. */
export const ADMISSION_TERMINAL_STATUSES = [
  "enrolled",
  "rejected",
  "withdrawn",
] as const satisfies readonly AdmissionStatus[];

export function isTerminalAdmissionStatus(status: AdmissionStatus): boolean {
  return (ADMISSION_TERMINAL_STATUSES as readonly AdmissionStatus[]).includes(status);
}

/**
 * The step after `status` on the happy path, or null at the end. A terminal
 * application has no next step, which is what lets the console offer one
 * obvious "move forward" action instead of the admin guessing the workflow.
 */
export function nextAdmissionStatus(status: AdmissionStatus): AdmissionStatus | null {
  const index = (ADMISSION_STATUS_FLOW as readonly AdmissionStatus[]).indexOf(status);
  if (index < 0 || index === ADMISSION_STATUS_FLOW.length - 1) return null;
  return ADMISSION_STATUS_FLOW[index + 1] ?? null;
}

/**
 * An offer letter only means something once a decision has been made in the
 * applicant's favour, so the letter is offered for `offered` and `enrolled`
 * alone -- not while the application is still under review.
 */
export function canIssueAdmissionLetter(status: AdmissionStatus): boolean {
  return status === "offered" || status === "enrolled";
}

/** Entrance scores are a percentage, and blank means "not yet sat". */
export function isValidEntranceScore(value: number | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  return Number.isFinite(value) && value >= 0 && value <= 100;
}
