import type { FeeInvoiceStatus, FeePaymentStatus } from "@/types/database";

// Client-safe label and tone helpers. A client component must not import from
// @/services/* (those pull in next/headers and break the build), so everything
// presentational for fees lives here.

export const feeInvoiceStatusLabels: Record<FeeInvoiceStatus, string> = {
  unpaid: "Unpaid",
  partially_paid: "Part paid",
  paid: "Paid",
  waived: "Waived",
  void: "Cancelled",
};

export function feeInvoiceStatusLabel(status: FeeInvoiceStatus): string {
  return feeInvoiceStatusLabels[status] ?? "Unpaid";
}

export function feeInvoiceStatusTone(
  status: FeeInvoiceStatus,
): "ok" | "warn" | "muted" | "bad" {
  switch (status) {
    case "paid":
      return "ok";
    case "partially_paid":
      return "warn";
    case "void":
      return "muted";
    default:
      return "bad";
  }
}

export const feePaymentStatusLabels: Record<FeePaymentStatus, string> = {
  pending: "Awaiting payment",
  submitted: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
  failed: "Failed",
};

export function feePaymentStatusLabel(status: FeePaymentStatus): string {
  return feePaymentStatusLabels[status] ?? "Unknown";
}

export function feePaymentStatusTone(
  status: FeePaymentStatus,
): "ok" | "warn" | "muted" | "bad" {
  switch (status) {
    case "approved":
      return "ok";
    case "submitted":
    case "pending":
      return "warn";
    case "rejected":
    case "failed":
      return "bad";
    default:
      return "muted";
  }
}

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

/**
 * Local rather than reusing services/billing's formatPrice, because that module
 * pulls in next/headers and would break any component that renders in the
 * browser.
 */
export function formatNaira(amount: number, currency = "NGN"): string {
  if (currency !== "NGN") {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return naira.format(amount);
}
