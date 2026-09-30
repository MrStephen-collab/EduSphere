import type { ComplaintCategory, ComplaintStatus } from "@/types/database";

// Complaint labels live here rather than in the service so that client
// components can import them. Importing from the service would pull its
// server-only dependencies (next/headers via the Supabase server client) into
// the browser bundle, which fails the build.

export const complaintCategoryLabels: Record<ComplaintCategory, string> = {
  academics: "Academics",
  fees: "Fees & payments",
  conduct: "Student conduct",
  facilities: "Facilities",
  staff: "Staff",
  transport: "Transport",
  other: "Other",
};

/** Ordered for the parent's category picker, most common first. */
export const complaintCategoryOptions: { value: ComplaintCategory; label: string }[] = [
  { value: "academics", label: complaintCategoryLabels.academics },
  { value: "fees", label: complaintCategoryLabels.fees },
  { value: "conduct", label: complaintCategoryLabels.conduct },
  { value: "facilities", label: complaintCategoryLabels.facilities },
  { value: "staff", label: complaintCategoryLabels.staff },
  { value: "transport", label: complaintCategoryLabels.transport },
  { value: "other", label: complaintCategoryLabels.other },
];

export const complaintStatusLabels: Record<ComplaintStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

export const COMPLAINT_STATUSES = ["open", "in_progress", "resolved"] as const satisfies readonly ComplaintStatus[];

export const COMPLAINT_CATEGORIES = [
  "academics",
  "fees",
  "conduct",
  "facilities",
  "staff",
  "transport",
  "other",
] as const satisfies readonly ComplaintCategory[];

export function complaintCategoryLabel(category: string): string {
  return complaintCategoryLabels[category as ComplaintCategory] ?? complaintCategoryLabels.other;
}

export function complaintStatusLabel(status: string): string {
  return complaintStatusLabels[status as ComplaintStatus] ?? status;
}
