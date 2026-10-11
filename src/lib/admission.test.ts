import { describe, expect, it } from "vitest";
import {
  ADMISSION_STATUS_FLOW,
  ADMISSION_TERMINAL_STATUSES,
  APPLICATION_NUMBER_PREFIX,
  applicationNumberFromSeed,
  buildApplicationNumber,
  canIssueAdmissionLetter,
  isTerminalAdmissionStatus,
  isValidEntranceScore,
  nextAdmissionStatus,
} from "@/lib/admission";
import {
  ADMISSION_STATUSES,
  admissionStatusLabel,
  admissionStatusLabels,
} from "@/lib/admission-labels";
import type { AdmissionStatus } from "@/types/database";

const ALL_STATUSES: AdmissionStatus[] = [
  "submitted",
  "under_review",
  "entrance",
  "offered",
  "enrolled",
  "rejected",
  "withdrawn",
];

describe("applicationNumberFromSeed", () => {
  it("is deterministic for the same seed", () => {
    expect(applicationNumberFromSeed("abc123")).toBe(applicationNumberFromSeed("abc123"));
  });

  it("uses the ADM- prefix and uppercases the seed", () => {
    const value = applicationNumberFromSeed("a1b2c3d4e5f6");
    expect(value.startsWith(APPLICATION_NUMBER_PREFIX)).toBe(true);
    expect(value).toBe("ADM-A1B2C3D4");
  });

  it("strips characters that are not alphanumeric", () => {
    expect(applicationNumberFromSeed("a1-b2-c3-d4")).toBe("ADM-A1B2C3D4");
  });

  it("pads a short seed so every reference is the same width", () => {
    expect(applicationNumberFromSeed("ab")).toBe("ADM-000000AB");
  });
});

describe("buildApplicationNumber", () => {
  it("matches the ADM-XXXXXXXX shape", () => {
    expect(buildApplicationNumber()).toMatch(/^ADM-[0-9A-F]{8}$/);
  });

  it("does not repeat", () => {
    expect(buildApplicationNumber()).not.toBe(buildApplicationNumber());
  });
});

describe("workflow", () => {
  it("runs the happy path in order and stops at enrolled", () => {
    expect(ADMISSION_STATUS_FLOW).toEqual([
      "submitted",
      "under_review",
      "entrance",
      "offered",
      "enrolled",
    ]);
    expect(nextAdmissionStatus("submitted")).toBe("under_review");
    expect(nextAdmissionStatus("offered")).toBe("enrolled");
    expect(nextAdmissionStatus("enrolled")).toBeNull();
  });

  it("has no forward step from an exit", () => {
    expect(nextAdmissionStatus("rejected")).toBeNull();
    expect(nextAdmissionStatus("withdrawn")).toBeNull();
  });

  it("treats only real exits as terminal", () => {
    for (const status of ALL_STATUSES) {
      const expected = status === "enrolled" || status === "rejected" || status === "withdrawn";
      expect(isTerminalAdmissionStatus(status)).toBe(expected);
    }
    expect(ADMISSION_TERMINAL_STATUSES).toEqual(["enrolled", "rejected", "withdrawn"]);
  });
});

describe("canIssueAdmissionLetter", () => {
  it("is only true once a decision went the applicant's way", () => {
    expect(canIssueAdmissionLetter("offered")).toBe(true);
    expect(canIssueAdmissionLetter("enrolled")).toBe(true);
    expect(canIssueAdmissionLetter("under_review")).toBe(false);
    expect(canIssueAdmissionLetter("rejected")).toBe(false);
  });
});

describe("isValidEntranceScore", () => {
  it("accepts a percentage and rejects everything else", () => {
    expect(isValidEntranceScore(0)).toBe(true);
    expect(isValidEntranceScore(73.5)).toBe(true);
    expect(isValidEntranceScore(100)).toBe(true);
    expect(isValidEntranceScore(-1)).toBe(false);
    expect(isValidEntranceScore(101)).toBe(false);
    expect(isValidEntranceScore(null)).toBe(false);
    expect(isValidEntranceScore(undefined)).toBe(false);
    expect(isValidEntranceScore(Number.NaN)).toBe(false);
  });
});

describe("admission labels", () => {
  it("labels every status", () => {
    expect(Object.keys(admissionStatusLabels).sort()).toEqual([...ALL_STATUSES].sort());
  });

  it("orders the picker over every status", () => {
    expect([...ADMISSION_STATUSES].sort()).toEqual([...ALL_STATUSES].sort());
  });

  it("falls back to the raw value for an unknown status", () => {
    expect(admissionStatusLabel("submitted")).toBe("New application");
    expect(admissionStatusLabel("something_else")).toBe("something_else");
  });
});
