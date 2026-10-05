import { describe, expect, it } from "vitest";
import {
  CONTENT_CATEGORIES,
  CORE_CONTENT_CATEGORIES,
  HIGHER_ED_CONTENT_CATEGORIES,
  contentCategoriesForLevel,
  contentCategoryDescriptions,
  contentCategoryLabels,
  isContentCategory,
  levelOffersCategory,
  materialCategoryForContent,
} from "./content-categories";

describe("contentCategoriesForLevel", () => {
  it("offers the core categories to every school", () => {
    for (const level of ["primary", "secondary", "college"] as const) {
      const offered = contentCategoriesForLevel(level);
      for (const category of CORE_CONTENT_CATEGORIES) {
        expect(offered).toContain(category);
      }
    }
  });

  it("adds the teaching categories only for higher education", () => {
    for (const level of ["college", "polytechnic", "university"] as const) {
      const offered = contentCategoriesForLevel(level);
      for (const category of HIGHER_ED_CONTENT_CATEGORIES) {
        expect(offered).toContain(category);
      }
    }
  });

  it("keeps the higher-education categories away from schools below it", () => {
    for (const level of ["primary", "secondary"] as const) {
      const offered = contentCategoriesForLevel(level);
      expect(offered).toEqual([...CORE_CONTENT_CATEGORIES]);
      for (const category of HIGHER_ED_CONTENT_CATEGORIES) {
        expect(offered).not.toContain(category);
      }
    }
  });

  it("falls back to secondary when the level is unset or unknown", () => {
    expect(contentCategoriesForLevel(null)).toEqual([...CORE_CONTENT_CATEGORIES]);
    expect(contentCategoriesForLevel(undefined)).toEqual([...CORE_CONTENT_CATEGORIES]);
  });
});

describe("levelOffersCategory", () => {
  it("allows a lab at a university but not at a secondary school", () => {
    expect(levelOffersCategory("university", "lab")).toBe(true);
    expect(levelOffersCategory("secondary", "lab")).toBe(false);
  });

  it("allows a video lesson anywhere", () => {
    expect(levelOffersCategory("secondary", "video")).toBe(true);
    expect(levelOffersCategory("primary", "video")).toBe(true);
  });
});

describe("isContentCategory", () => {
  it("rejects values that are not categories", () => {
    expect(isContentCategory("video")).toBe(true);
    expect(isContentCategory("quiz")).toBe(false);
    expect(isContentCategory(null)).toBe(false);
    expect(isContentCategory(7)).toBe(false);
  });
});

describe("materialCategoryForContent", () => {
  it("starts the uploader on the matching upload type", () => {
    expect(materialCategoryForContent("video")).toBe("video");
    expect(materialCategoryForContent("audio")).toBe("audio");
    expect(materialCategoryForContent("pdf")).toBe("pdf");
    expect(materialCategoryForContent("image")).toBe("image");
    expect(materialCategoryForContent("link")).toBe("link");
  });

  it("starts slides and higher-education categories on a document", () => {
    expect(materialCategoryForContent("slides")).toBe("document");
    expect(materialCategoryForContent("lecture")).toBe("document");
    expect(materialCategoryForContent("exam_prep")).toBe("document");
  });

  it("falls back to a document when a lesson has no category", () => {
    expect(materialCategoryForContent(null)).toBe("document");
    expect(materialCategoryForContent(undefined)).toBe("document");
  });
});

describe("taxonomy tables", () => {
  it("names and describes every category", () => {
    for (const category of CONTENT_CATEGORIES) {
      expect(contentCategoryLabels[category]).toBeTruthy();
      expect(contentCategoryDescriptions[category]).toBeTruthy();
    }
  });

  it("does not list a category twice", () => {
    expect(new Set(CONTENT_CATEGORIES).size).toBe(CONTENT_CATEGORIES.length);
  });
});
