// School logo rules (spec section 34 / branding).
//
// Shared by the client (so a bad file is caught before an upload is attempted)
// and the server (so a crafted request cannot store something the bucket was
// never meant to hold). Kept pure and unit-tested because both sides depend on
// exactly the same limits.

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/** Raster types only. SVG is excluded on purpose (active content). */
export const LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type LogoMimeType = (typeof LOGO_MIME_TYPES)[number];

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function isAllowedLogoType(mimeType: string): mimeType is LogoMimeType {
  return (LOGO_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function logoExtension(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType] ?? "png";
}

/** Returns an error message when a file cannot be used, or null when it can. */
export function validateLogoFile(file: {
  type: string;
  size: number;
}): string | null {
  if (!isAllowedLogoType(file.type)) {
    return "Use a PNG, JPG or WebP image.";
  }
  if (file.size > LOGO_MAX_BYTES) {
    return "That image is larger than 2 MB. Please use a smaller one.";
  }
  return null;
}
