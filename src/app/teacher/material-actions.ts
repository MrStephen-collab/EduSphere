"use server";

import { revalidatePath } from "next/cache";
import {
  createMaterialUpload,
  finalizeMaterialUpload,
  getTeacherMaterial,
  purgeMaterialFile,
  materialUploadSchema,
  MaterialAccessError,
} from "@/services/material-storage";
import {
  buildPassthrough,
  createDirectUpload,
  deleteRemoteAsset,
  isVideoHostingConfigured,
  missingVideoHostingVars,
  VideoHostingUnavailableError,
} from "@/services/video-hosting";
import { deleteMaterial } from "@/services/learning";

export type StartUploadResult =
  | {
      ok: true;
      materialId: string;
      /** Supabase storage object path (empty for links and video). */
      uploadPath: string;
      token: string;
      /** Set when the bytes go to the external video host instead. */
      providerUploadUrl: string | null;
    }
  | { ok: false; error: string };

function describe(e: unknown): string {
  if (e instanceof MaterialAccessError) return e.message;
  if (e instanceof VideoHostingUnavailableError) return e.message;
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

/**
 * Creates the material row and returns a one-time destination for the file.
 *
 * Documents, PDFs, images and audio go to the private Supabase bucket via a
 * signed upload URL. Video goes to the external host via its own direct-upload
 * URL, because large lesson videos do not belong in the app's storage bucket.
 * Either way the browser sends the bytes straight to the destination.
 */
export async function startMaterialUploadAction(input: {
  lessonId: string;
  courseId: string;
  title: string;
  category: "document" | "pdf" | "video" | "audio" | "image" | "link";
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  fileUrl?: string;
}): Promise<StartUploadResult> {
  try {
    const { courseId, ...rest } = input;
    const data = materialUploadSchema.parse(rest);

    if (data.category === "link" && !data.fileUrl) {
      return { ok: false, error: "Paste a link for this material." };
    }

    if (data.category === "video" && !isVideoHostingConfigured()) {
      return {
        ok: false,
        error: `Video hosting is not set up yet (missing ${missingVideoHostingVars().join(", ")}). Documents, PDFs and audio uploads work now.`,
      };
    }

    const created = await createMaterialUpload(data);
    revalidatePath(`/teacher/courses/${courseId}/lessons/${data.lessonId}`);

    if (data.category === "video") {
      const upload = await createDirectUpload(
        process.env.NEXT_PUBLIC_APP_URL ?? "https://edusphere-taupe.vercel.app",
        buildPassthrough(created.materialId),
      );
      return {
        ok: true,
        materialId: created.materialId,
        uploadPath: "",
        token: "",
        providerUploadUrl: upload.uploadUrl,
      };
    }

    return {
      ok: true,
      materialId: created.materialId,
      uploadPath: created.signedPath,
      token: created.token,
      providerUploadUrl: null,
    };
  } catch (e) {
    return { ok: false, error: describe(e) };
  }
}

/** Confirms the bytes landed and records the real file size. */
export async function completeMaterialUploadAction(
  materialId: string,
  lessonId: string,
  courseId: string,
): Promise<StartUploadResult> {
  try {
    await finalizeMaterialUpload(materialId);
    revalidatePath(`/teacher/courses/${courseId}/lessons/${lessonId}`);
    return { ok: true, materialId, uploadPath: "", token: "", providerUploadUrl: null };
  } catch (e) {
    return { ok: false, error: describe(e) };
  }
}

/** Removes the stored file and the hosted asset before hiding the row. */
export async function deleteMaterialFileAction(
  id: string,
  lessonId: string,
  courseId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const material = await getTeacherMaterial(id);
    if (material) {
      await purgeMaterialFile(material);
      if (material.provider_asset_id) {
        await deleteRemoteAsset(material.provider_asset_id);
      }
    }
    await deleteMaterial(id);
    revalidatePath(`/teacher/courses/${courseId}/lessons/${lessonId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: describe(e) };
  }
}
