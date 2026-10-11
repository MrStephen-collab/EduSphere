import type { AdmissionStatus } from "@/types/database";

// Admission labels live here rather than in the service so that client
// components can import them. Importing from the service would pull its
// server-only dependencies (next/headers via the Supabase server client) into
// the browser bundle, which fails the build.

export const admissionStatusLabels: Record<AdmissionStatus, string> = {
  submitted: "New application",
  under_review: "Under review",
  entrance: "Entrance assessment",
  offered: "Offer made",
  enrolled: "Enrolled",
  rejected: "Not offered",
  withdrawn: "Withdrawn",
};

/**
 * The order an admin works through, so a status picker reads like the
 * pipeline rather than alphabetically. Exits sit at the end.
 */
export const ADMISSION_STATUSES = [
  "submitted",
  "under_review",
  "entrance",
  "offered",
  "enrolled",
  "rejected",
  "withdrawn",
] as const satisfies readonly AdmissionStatus[];

export const genderOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const;

export function admissionStatusLabel(status: string): string {
  return admissionStatusLabels[status as AdmissionStatus] ?? status;
}
