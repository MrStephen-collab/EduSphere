import { createAdminClient } from "@/lib/supabase/admin";
import { requireSchoolAdmin } from "@/services/shared";
import { isAllowedLogoType, logoExtension } from "@/lib/school-logo";

// ---------------------------------------------------------------------------
// School assets (logos)
//
// Public bucket, so the stored object is served straight off the CDN. The
// upload still goes through a one-time signed URL minted here (with the service
// role) after an admin check, so the bytes never pass through this server and
// the object can only land in the caller's own school folder.
// ---------------------------------------------------------------------------

export const SCHOOL_ASSETS_BUCKET = "school-assets";

export type LogoUpload = {
  /** Path within the bucket, e.g. "<school_id>/logo-1712345678.png". */
  path: string;
  /** One-time token for supabase.storage.uploadToSignedUrl. */
  token: string;
  /** The public URL the object will have once uploaded. */
  publicUrl: string;
};

/**
 * Mints an upload for the caller's own school logo. Only a school owner or
 * admin may call this; the school is taken from the caller's session, never
 * from a client-supplied id, so nobody can write into another school's folder.
 */
export async function createSchoolLogoUpload(mimeType: string): Promise<LogoUpload> {
  const { schoolId } = await requireSchoolAdmin();
  if (!isAllowedLogoType(mimeType)) {
    throw new Error("Use a PNG, JPG or WebP image.");
  }

  const admin = createAdminClient();
  const path = `${schoolId}/logo-${Date.now()}.${logoExtension(mimeType)}`;

  const { data: signed, error } = await admin.storage
    .from(SCHOOL_ASSETS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !signed) {
    throw new Error("We couldn't prepare the upload. Please try again.");
  }

  const { data: publicUrlData } = admin.storage
    .from(SCHOOL_ASSETS_BUCKET)
    .getPublicUrl(signed.path);

  return {
    path: signed.path,
    token: signed.token,
    publicUrl: publicUrlData.publicUrl,
  };
}

/**
 * Stores the logo URL on the school. Caller must already have authorised the
 * write (settings via requireSchoolAdmin, onboarding via its own owner check),
 * so this only validates the URL shape and performs the update.
 */
export async function setSchoolLogo(
  schoolId: string,
  logoUrl: string | null,
): Promise<void> {
  if (logoUrl !== null && !/^https:\/\/\S+$/i.test(logoUrl.trim())) {
    throw new Error("That logo link doesn't look right.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("schools")
    .update({ logo_url: logoUrl ? logoUrl.trim() : null })
    .eq("id", schoolId);
  if (error) throw new Error("We couldn't save your logo.");
}

/** Convenience for the settings page: sets the logo on the caller's school. */
export async function updateSchoolLogoForCurrentAdmin(logoUrl: string | null): Promise<void> {
  const { schoolId } = await requireSchoolAdmin();
  await setSchoolLogo(schoolId, logoUrl);
}
