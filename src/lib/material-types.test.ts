import { describe, expect, it } from "vitest";
import {
  categoryAccept,
  categoryFileTypes,
  categoryForFileType,
  formatBytes,
  isRestrictedMaterial,
  materialCategories,
  materialCategoryLabels,
  maxUploadBytes,
  restrictedCategories,
} from "@/lib/material-types";

/**
 * The restricted list is the whole point of the feature, so it is pinned here.
 * Adding a category to `restrictedCategories` changes which files students are
 * denied a download link for, and that should never happen quietly.
 */

describe("material categories", () => {
  it("maps every stored file type back to a category", () => {
    for (const category of materialCategories) {
      for (const fileType of categoryFileTypes[category]) {
        expect(categoryForFileType(fileType)).toBe(category);
      }
    }
  });

  it("covers the categories the product promises teachers", () => {
    expect(materialCategories).toEqual(
      expect.arrayContaining(["document", "pdf", "video", "audio", "link"]),
    );
  });

  it("labels every category", () => {
    for (const category of materialCategories) {
      expect(materialCategoryLabels[category]).toBeTruthy();
    }
  });

  it("falls back to document for unknown or missing types", () => {
    expect(categoryForFileType(null)).toBe("document");
    expect(categoryForFileType("something-else")).toBe("document");
  });

  it("is case insensitive", () => {
    expect(categoryForFileType("PDF")).toBe("pdf");
    expect(categoryForFileType("Video")).toBe("video");
  });
});

describe("download restrictions", () => {
  it("locks video and audio only", () => {
    expect([...restrictedCategories].sort()).toEqual(["audio", "video"]);
  });

  it("marks video and audio as restricted", () => {
    expect(isRestrictedMaterial("video")).toBe(true);
    expect(isRestrictedMaterial("audio")).toBe(true);
  });

  it("leaves documents and pdfs downloadable", () => {
    // Students routinely need to save coursework, so these stay open.
    for (const open of ["pdf", "doc", "docx", "ppt", "pptx", "text", "image", "link"]) {
      expect(isRestrictedMaterial(open)).toBe(false);
    }
  });

  it("treats an unknown type as unrestricted rather than accidentally locked", () => {
    expect(isRestrictedMaterial("mystery")).toBe(false);
  });
});

describe("upload limits", () => {
  it("keeps video out of the app storage bucket entirely", () => {
    // Video is hosted separately, so its cap is not a bucket constraint.
    expect(maxUploadBytes.video).toBeGreaterThan(maxUploadBytes.pdf);
  });

  it("requires no file for a link", () => {
    expect(maxUploadBytes.link).toBe(0);
    expect(categoryAccept.link).toBe("");
  });

  it("caps every bucket-stored category at or below the bucket limit", () => {
    const bucketLimit = 50 * 1024 * 1024;
    for (const category of materialCategories) {
      // Video is the exception: it is hosted by the video provider, so its cap
      // is the provider's, not the storage bucket's.
      if (category === "video") continue;
      expect(maxUploadBytes[category]).toBeLessThanOrEqual(bucketLimit);
    }
  });
});

describe("formatBytes", () => {
  it("scales to a readable unit", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe("2.00 GB");
  });
});
