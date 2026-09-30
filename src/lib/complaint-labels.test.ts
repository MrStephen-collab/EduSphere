import { describe, expect, it } from "vitest";
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUSES,
  complaintCategoryLabel,
  complaintCategoryLabels,
  complaintCategoryOptions,
  complaintStatusLabel,
  complaintStatusLabels,
} from "@/lib/complaint-labels";

describe("complaint labels", () => {
  it("gives every category a human label", () => {
    for (const category of COMPLAINT_CATEGORIES) {
      expect(complaintCategoryLabels[category]).toBeTruthy();
    }
  });

  it("gives every status a human label", () => {
    for (const status of COMPLAINT_STATUSES) {
      expect(complaintStatusLabels[status]).toBeTruthy();
    }
  });

  it("falls back to 'other' for an unrecognised category", () => {
    // The column is a text column, so a value written by an older build can
    // still turn up. It must not render as a blank label.
    expect(complaintCategoryLabel("not-a-real-category")).toBe("Other");
    expect(complaintCategoryLabel("")).toBe("Other");
  });

  it("passes an unrecognised status through rather than mislabelling it", () => {
    // Unlike categories, a wrong status is worth surfacing verbatim: silently
    // calling it "Open" would misrepresent what the school has done.
    expect(complaintStatusLabel("escalated")).toBe("escalated");
  });

  it("does not title-case statuses with an underscore", () => {
    // "in_progress" must read as "In progress", never "In Progress" or
    // "in_progress" -- the parent-facing wording is deliberate.
    expect(complaintStatusLabel("in_progress")).toBe("In progress");
  });

  it("offers the parent a picker entry for every category", () => {
    expect(complaintCategoryOptions.map((o) => o.value)).toEqual([...COMPLAINT_CATEGORIES]);
  });

  it("keeps every picker label identical to the label map", () => {
    for (const option of complaintCategoryOptions) {
      expect(option.label).toBe(complaintCategoryLabels[option.value]);
    }
  });
});
