import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireContentEditor } from "@/services/shared";
import {
  categoryForFileType,
  isRestrictedMaterial,
  maxUploadBytes,
  type MaterialCategory,
} from "@/lib/material-types";

export const MATERIAL_BUCKET = "course-materials";

/**
 * Signed read URLs are deliberately short. A student opening a document gets a
 * link that stops working within minutes, so it cannot be pasted into a chat
 * and handed around, and the object itself is never publicly addressable.
 */
const STREAM_URL_TTL_SECONDS = 300;
const MAX_PATH_SEGMENTS = 80;

export type MaterialRecord = {
  id: string;
  school_id: string;
  lesson_id: string;
  title: string;
  file_type: string | null;
  file_url: string | null;
  file_size: number | null;
  mime_type: string | null;
  storage_path: string | null;
  download_restricted: boolean;
  provider: string | null;
  provider_asset_id: string | null;
  provider_playback_id: string | null;
  duration_seconds: number | null;
  created_by: string | null;
};

export type MaterialAccessGrant = {
  materialId: string;
  title: string;
  category: MaterialCategory;
  restricted: boolean;
  fileType: string | null;
  mimeType: string | null;
  fileSize: number | null;
  /** Present for private-bucket files. Absent for links and hosted video. */
  streamUrl: string | null;
  /** Present for externally hosted video. */
  playbackId: string | null;
  /** Identity string rendered into the forensic watermark. */
  watermark: string;
  viewerName: string;
  viewerId: string;
  expiresInSeconds: number | null;
};

// -----------------------------------------------------------------------------
// Upload validation
// -----------------------------------------------------------------------------

export const materialUploadSchema = z.object({
  lessonId: z.string().uuid(),
  title: z.string().trim().min(2, "Give the material a title").max(160),
  category: z.enum(["document", "pdf", "video", "audio", "image", "link"]),
  fileName: z.string().trim().min(1).max(255).optional(),
  mimeType: z.string().trim().max(120).optional(),
  sizeBytes: z.number().int().positive().optional(),
  fileUrl: z.string().trim().max(1000).optional(),
});

function fileTypeForCategory(category: MaterialCategory, fileName?: string | null): string {
  if (category === "link") return "link";
  if (category === "document") {
    const ext = (fileName ?? "").split(".").pop()?.toLowerCase() ?? "";
    if (ext === "docx") return "docx";
    if (ext === "pptx") return "pptx";
    if (ext === "ppt") return "ppt";
    if (ext === "doc") return "doc";
    if (ext === "md") return "text";
    return "text";
  }
  return category;
}

/** Strips anything that could escape the intended folder or confuse a browser. */
function sanitizeSegment(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .slice(0, MAX_PATH_SEGMENTS);
}

function buildStoragePath(schoolId: string, lessonId: string, fileName: string): string {
  const safeName = sanitizeSegment(fileName) || "file";
  return `${schoolId}/${lessonId}/${Date.now()}-${safeName}`;
}

function assertUploadAllowed(
  category: MaterialCategory,
  sizeBytes: number | undefined,
): void {
  const limit = maxUploadBytes[category];
  if (category === "link") return;
  if (!sizeBytes) throw new Error("Choose a file to upload.");
  if (sizeBytes > limit) {
    throw new Error(
      `That file is too large for ${category} uploads (limit ${Math.round(limit / (1024 * 1024))} MB).`,
    );
  }
}

// -----------------------------------------------------------------------------
// Authorisation
// -----------------------------------------------------------------------------

export class MaterialAccessError extends Error {}

/**
 * Confirms the signed-in teacher actually owns the course the lesson belongs
 * to. Mirrors the `is_own_course` database rule, and is re-checked here rather
 * than trusted from the client.
 */
async function requireOwnedLesson(
  lessonId: string,
): Promise<{ schoolId: string; userId: string; role: string; teacherId: string | null }> {
  const editor = await requireContentEditor();
  const admin = createAdminClient();

  const { data: lesson } = await admin
    .from("lessons")
    .select("id, course_id, school_id")
    .eq("id", lessonId)
    .eq("school_id", editor.schoolId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!lesson) throw new MaterialAccessError("That lesson no longer exists.");

  if (editor.role === "TEACHER") {
    if (!editor.teacherId) {
      throw new MaterialAccessError("Your teacher profile is not set up yet.");
    }
    const { data: course } = await admin
      .from("courses")
      .select("id, teacher_id")
      .eq("id", lesson.course_id)
      .eq("school_id", editor.schoolId)
      .maybeSingle();

    if (!course || course.teacher_id !== editor.teacherId) {
      throw new MaterialAccessError("You can only add materials to your own courses.");
    }
  }

  return {
    schoolId: editor.schoolId,
    userId: editor.userId,
    role: editor.role,
    teacherId: editor.teacherId,
  };
}

/**
 * Resolves the caller's right to read one material.
 *
 * Students are matched on class, not just school membership: a student may only
 * open materials belonging to a course for their own class. Teachers may read
 * materials on courses they own; school managers may read anything in their
 * school.
 */
async function authorizeMaterialRead(
  materialId: string,
): Promise<{
  material: MaterialRecord;
  schoolId: string;
  viewerId: string;
  viewerRole: string;
  viewerName: string;
}> {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");

  const membership =
    context.memberships.find((m) => m.role === "STUDENT") ??
    context.memberships.find((m) =>
      ["SCHOOL_OWNER", "SCHOOL_ADMIN", "TEACHER"].includes(m.role),
    );
  if (!membership) throw new MaterialAccessError("You do not have access to this material.");

  const schoolId = membership.school.id;
  const supabase = await createSupabaseServerClient();

  const { data: material } = await supabase
    .from("lesson_materials")
    .select("*")
    .eq("id", materialId)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!material) throw new MaterialAccessError("That material is not available.");

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, course_id, status, deleted_at")
    .eq("id", material.lesson_id)
    .eq("school_id", schoolId)
    .maybeSingle();

  const { data: course } = lesson
    ? await supabase
        .from("courses")
        .select("id, class_id, subject_id, teacher_id, status, deleted_at")
        .eq("id", lesson.course_id)
        .eq("school_id", schoolId)
        .maybeSingle()
    : { data: null };

  const unpublished = !lesson || !course || lesson.deleted_at || course.deleted_at;
  const isPublished = lesson?.status === "published" && course?.status === "published";

  if (membership.role === "STUDENT") {
    if (unpublished || !isPublished) {
      throw new MaterialAccessError("That material is not available.");
    }

    const { data: student } = await supabase
      .from("students")
      .select("id, class_id, stream_id")
      .eq("school_id", schoolId)
      .eq("user_id", context.user.id)
      .maybeSingle();

    if (!student) throw new MaterialAccessError("Your student profile is not set up yet.");
    if (!course || student.class_id !== course.class_id) {
      throw new MaterialAccessError("That material belongs to another class.");
    }
  } else if (membership.role === "TEACHER") {
    const { data: teacher } = await supabase
      .from("teachers")
      .select("id")
      .eq("school_id", schoolId)
      .eq("user_id", context.user.id)
      .maybeSingle();

    if (!teacher || !course || course.teacher_id !== teacher.id) {
      throw new MaterialAccessError("You can only view materials on your own courses.");
    }
  }

  return {
    material: material as MaterialRecord,
    schoolId,
    viewerId: context.user.id,
    viewerRole: membership.role,
    viewerName: context.profile?.full_name ?? context.user.email ?? "Learner",
  };
}

function watermarkFor(viewer: { name: string; id: string }): string {
  const short = viewer.id.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `${viewer.name} · ${short}`;
}

async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    return {
      ip: forwarded ? forwarded.split(",")[0].trim() : h.get("x-real-ip"),
      userAgent: h.get("user-agent"),
    };
  } catch {
    return { ip: null, userAgent: null };
  }
}

// -----------------------------------------------------------------------------
// Teacher operations
// -----------------------------------------------------------------------------

/**
 * Creates the material row up front and hands back a signed upload URL so the
 * browser streams bytes straight to storage. Files never pass through the
 * Next.js server, which keeps large uploads off the request body limit.
 */
export async function createMaterialUpload(
  input: z.infer<typeof materialUploadSchema>,
): Promise<{ materialId: string; uploadPath: string; signedPath: string; token: string }> {
  const data = materialUploadSchema.parse(input);
  assertUploadAllowed(data.category, data.sizeBytes);

  const { schoolId, userId } = await requireOwnedLesson(data.lessonId);
  const admin = createAdminClient();

  const fileType = fileTypeForCategory(data.category, data.fileName);
  const restricted = isRestrictedMaterial(fileType) && data.category !== "video";

  const { data: row, error } = await admin
    .from("lesson_materials")
    .insert({
      school_id: schoolId,
      lesson_id: data.lessonId,
      title: data.title,
      file_type: fileType,
      file_url: data.fileUrl ?? null,
      mime_type: data.mimeType ?? null,
      file_size: data.sizeBytes ?? null,
      download_restricted: restricted,
      is_public: false,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !row) throw new Error("We couldn't start that upload.");

  if (data.category === "link") {
    return { materialId: row.id, uploadPath: "", signedPath: "", token: "" };
  }

  const storagePath = buildStoragePath(schoolId, data.lessonId, data.fileName ?? "file");

  const { data: signed, error: signError } = await admin.storage
    .from(MATERIAL_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (signError || !signed) {
    await admin.from("lesson_materials").delete().eq("id", row.id);
    throw new Error("We couldn't prepare the upload.");
  }

  await admin
    .from("lesson_materials")
    .update({ storage_path: storagePath })
    .eq("id", row.id);

  return {
    materialId: row.id,
    uploadPath: signed.path,
    signedPath: signed.path,
    token: signed.token,
  };
}

/** Confirms the object actually landed in storage, and records its true size. */
export async function finalizeMaterialUpload(materialId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: material } = await admin
    .from("lesson_materials")
    .select("id, storage_path, lesson_id, school_id")
    .eq("id", materialId)
    .maybeSingle();

  if (!material?.storage_path) return;

  await requireOwnedLessonForMaterial(material);

  const { data: blob, error } = await admin.storage
    .from(MATERIAL_BUCKET)
    .list(material.storage_path.split("/").slice(0, -1).join("/"), {
      search: material.storage_path.split("/").pop(),
      limit: 1,
    });

  if (error) throw new Error("We couldn't verify that upload.");

  const found = blob?.[0];
  if (!found) {
    await admin.from("lesson_materials").delete().eq("id", material.id);
    throw new Error("That upload did not complete. Please try again.");
  }

  await admin
    .from("lesson_materials")
    .update({ file_size: found.metadata?.size ?? null })
    .eq("id", material.id);
}

async function requireOwnedLessonForMaterial(material: {
  lesson_id: string;
}): Promise<void> {
  await requireOwnedLesson(material.lesson_id);
}

/** Removes the stored object as well as the row. */
export async function purgeMaterialFile(material: MaterialRecord): Promise<void> {
  if (!material.storage_path) return;
  const admin = createAdminClient();
  await admin.storage.from(MATERIAL_BUCKET).remove([material.storage_path]);
}

// -----------------------------------------------------------------------------
// Student / viewer operations
// -----------------------------------------------------------------------------

/**
 * Mints a short-lived read grant for one material. The bucket has no select
 * policy, so this signed URL is the only way to read the bytes.
 */
export async function requestMaterialAccess(materialId: string): Promise<MaterialAccessGrant> {
  const { material, viewerId, viewerName, viewerRole } = await authorizeMaterialRead(materialId);
  const category = categoryForFileType(material.file_type);
  const restricted = isRestrictedMaterial(material.file_type);

  if (material.file_type === "link") {
    return {
      materialId: material.id,
      title: material.title,
      category,
      restricted: false,
      fileType: material.file_type,
      mimeType: null,
      fileSize: null,
      streamUrl: material.file_url,
      playbackId: null,
      watermark: watermarkFor({ name: viewerName, id: viewerId }),
      viewerName,
      viewerId,
      expiresInSeconds: null,
    };
  }

  if (material.provider && material.provider_playback_id) {
    return {
      materialId: material.id,
      title: material.title,
      category,
      restricted: true,
      fileType: material.file_type,
      mimeType: material.mime_type,
      fileSize: material.file_size,
      streamUrl: null,
      playbackId: material.provider_playback_id,
      watermark: watermarkFor({ name: viewerName, id: viewerId }),
      viewerName,
      viewerId,
      expiresInSeconds: 300,
    };
  }

  if (!material.storage_path) {
    throw new MaterialAccessError("That file is still processing. Try again shortly.");
  }

  const admin = createAdminClient();

  // Restricted media is served inline, never as an attachment. Handing the
  // browser a `download` disposition for locked audio would let a student save
  // it with one click, which is exactly what the lock is meant to prevent.
  const disposition = restricted
    ? {}
    : { download: downloadFilename(material) };

  const { data: signed, error } = await admin.storage
    .from(MATERIAL_BUCKET)
    .createSignedUrl(material.storage_path, STREAM_URL_TTL_SECONDS, disposition);

  if (error || !signed?.signedUrl) {
    throw new MaterialAccessError("We couldn't open that file right now.");
  }

  const { ip, userAgent } = await requestMeta();

  await admin.from("video_access_log").insert({
    school_id: material.school_id,
    material_id: material.id,
    lesson_id: material.lesson_id,
    viewer_id: viewerId,
    viewer_role: viewerRole,
    provider: "supabase-storage",
    asset_id: material.storage_path,
    token_subject: viewerId,
    ip_address: ip,
    user_agent: userAgent,
  });

  return {
    materialId: material.id,
    title: material.title,
    category,
    restricted,
    fileType: material.file_type,
    mimeType: material.mime_type,
    fileSize: material.file_size,
    streamUrl: signed.signedUrl,
    playbackId: null,
    watermark: watermarkFor({ name: viewerName, id: viewerId }),
    viewerName,
    viewerId,
    expiresInSeconds: STREAM_URL_TTL_SECONDS,
  };
}

// -----------------------------------------------------------------------------
// Playback authorisation
// -----------------------------------------------------------------------------

export type PlaybackAuthorization = {
  material: MaterialRecord;
  schoolId: string;
  viewerId: string;
  viewerName: string;
  viewerRole: string;
  playbackId: string;
};

/**
 * Authorises a viewer to play one hosted video and hands back the identity that
 * the signed token is bound to.
 *
 * Kept separate from token minting so this module never has to know how the
 * video host signs its tokens; the caller mints and logs.
 */
export async function authorizeVideoPlayback(
  materialId: string,
): Promise<PlaybackAuthorization> {
  const { material, schoolId, viewerId, viewerName, viewerRole } =
    await authorizeMaterialRead(materialId);

  if (!material.provider_playback_id) {
    throw new MaterialAccessError("That video is still being prepared. Try again shortly.");
  }

  return {
    material,
    schoolId,
    viewerId,
    viewerName,
    viewerRole,
    playbackId: material.provider_playback_id,
  };
}

/** Writes the forensic record for one playback grant. */
export async function recordPlaybackAccess(input: {
  schoolId: string;
  materialId: string;
  lessonId: string;
  viewerId: string;
  viewerRole: string;
  provider: string;
  assetId: string | null;
  playbackId: string;
  tokenSubject: string;
}): Promise<void> {
  const { ip, userAgent } = await requestMeta();
  const admin = createAdminClient();

  await admin.from("video_access_log").insert({
    school_id: input.schoolId,
    material_id: input.materialId,
    lesson_id: input.lessonId,
    viewer_id: input.viewerId,
    viewer_role: input.viewerRole,
    provider: input.provider,
    asset_id: input.assetId,
    playback_id: input.playbackId,
    token_subject: input.tokenSubject,
    ip_address: ip,
    user_agent: userAgent,
  });
}

function downloadFilename(material: MaterialRecord): string {  const fromPath = material.storage_path?.split("/").pop();
  if (fromPath) return fromPath.replace(/^\d+-/, "");
  const slug = material.title
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-");
  const ext = material.file_type && material.file_type !== "other" ? `.${material.file_type}` : "";
  return `${slug || "material"}${ext}`;
}

/** Teacher-facing list entry, including whether the file still exists. */
export async function getTeacherMaterial(materialId: string): Promise<MaterialRecord | null> {
  const { schoolId } = await requireOwnedLessonForMaterialId(materialId);
  const admin = createAdminClient();
  const { data } = await admin
    .from("lesson_materials")
    .select("*")
    .eq("id", materialId)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as MaterialRecord) ?? null;
}

async function requireOwnedLessonForMaterialId(
  materialId: string,
): Promise<{ schoolId: string }> {
  const admin = createAdminClient();
  const { data: material } = await admin
    .from("lesson_materials")
    .select("id, lesson_id, school_id")
    .eq("id", materialId)
    .maybeSingle();

  if (!material) throw new MaterialAccessError("That material no longer exists.");
  const { schoolId } = await requireOwnedLesson(material.lesson_id);
  return { schoolId };
}
