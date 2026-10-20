import { z } from "zod";
import type { AdmissionStatus } from "@/types/database";

// Admission labels live here rather than in the service so that client
// components can import them. Importing from the service would pull its
// server-only dependencies (next/headers via the Supabase server client) into
// the browser bundle, which fails the build. The settings schema lives here
// for the same reason: the admin form validates before the round trip.

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

/**
 * Curated currency list for the application fee. Kept small on purpose: the
 * fee is display-only today, so a school picking an odd code gains nothing
 * and a typo'd ISO code would render as a raw string on the public page.
 */
export const ADMISSION_FEE_CURRENCIES = [
  "NGN",
  "GHS",
  "KES",
  "ZAR",
  "USD",
  "GBP",
  "EUR",
] as const;

const dateOrNull = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.iso.datetime({ offset: true }).nullable(),
);

/**
 * The admin settings form's input. `opensAt`/`closesAt` arrive as full ISO
 * strings (converted from a `datetime-local` input in the browser) or as null
 * when that side of the window is unbounded.
 */
export const admissionSettingsSchema = z
  .object({
    enabled: z.boolean(),
    opensAt: dateOrNull,
    closesAt: dateOrNull,
    intakeLabel: z.string().trim().max(120).optional().nullable(),
    introMessage: z.string().trim().max(600).optional().nullable(),
    applicationFeeAmount: z.coerce
      .number({ error: "Enter a fee amount" })
      .min(0, "Fee cannot be negative")
      .max(100_000_000)
      .optional(),
    applicationFeeCurrency: z.enum(ADMISSION_FEE_CURRENCIES).default("NGN"),
    feeNote: z.string().trim().max(200).optional().nullable(),
  })
  .refine(
    (data) => !data.opensAt || !data.closesAt || data.opensAt < data.closesAt,
    { message: "The closing date must be after the opening date.", path: ["closesAt"] },
  );

export type AdmissionSettingsInput = z.input<typeof admissionSettingsSchema>;
