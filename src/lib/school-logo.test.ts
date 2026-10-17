import { describe, expect, it } from "vitest";
import {
  isAllowedLogoType,
  logoExtension,
  LOGO_MAX_BYTES,
  validateLogoFile,
} from "./school-logo";

describe("isAllowedLogoType", () => {
  it("accepts the raster image types the bucket allows", () => {
    expect(isAllowedLogoType("image/png")).toBe(true);
    expect(isAllowedLogoType("image/jpeg")).toBe(true);
    expect(isAllowedLogoType("image/webp")).toBe(true);
  });

  it("rejects SVG and non-images", () => {
    expect(isAllowedLogoType("image/svg+xml")).toBe(false);
    expect(isAllowedLogoType("application/pdf")).toBe(false);
    expect(isAllowedLogoType("")).toBe(false);
  });
});

describe("logoExtension", () => {
  it("maps each allowed type to a file extension", () => {
    expect(logoExtension("image/png")).toBe("png");
    expect(logoExtension("image/jpeg")).toBe("jpg");
    expect(logoExtension("image/webp")).toBe("webp");
  });

  it("falls back to png for anything unknown", () => {
    expect(logoExtension("image/gif")).toBe("png");
  });
});

describe("validateLogoFile", () => {
  it("passes a reasonable image", () => {
    expect(validateLogoFile({ type: "image/png", size: 100_000 })).toBeNull();
  });

  it("rejects the wrong file type", () => {
    expect(validateLogoFile({ type: "image/svg+xml", size: 100 })).toMatch(/PNG, JPG or WebP/);
  });

  it("rejects a file past the size limit", () => {
    expect(validateLogoFile({ type: "image/png", size: LOGO_MAX_BYTES + 1 })).toMatch(/2 MB/);
    expect(validateLogoFile({ type: "image/png", size: LOGO_MAX_BYTES })).toBeNull();
  });
});
