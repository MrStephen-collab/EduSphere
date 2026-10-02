"use server";

import { revalidatePath } from "next/cache";
import {
  createMaterialUpload,
  finalizeMaterialUpload,
  getPendingUploadId,
  getTeacherMaterial,
  purgeMaterialFile,
  recordPendingUpload,
  materialUploadSchema,
  MaterialAccessError,
} from "@/services/material-storage";
import {
  applyAssetReady,
  buildPassthrough,
  createDirectUpload,
  deleteRemoteAsset,
  isVideoHostingConfigured,
  missingVideoHostingVars,
  pollDirectUpload,
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
      /** True when the bytes landed but the host is still encoding. */
      pending?: boolean;
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

      // The upload id is what the completion step polls. Losing it would leave
      // the row with no way to reach the asset, so a failure here must not leave
      // an orphan material behind.
      try {
        await recordPendingUpload(created.materialId, upload.uploadId);
      } catch (e) {
        await deleteMaterial(created.materialId);
        throw e;
      }

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

/** How long to wait for the video host to finish encoding before giving up. */
const VIDEO_READY_TIMEOUT_MS = 45_000;
/** A pull from the lesson page should answer promptly rather than hold a request. */
const VIDEO_REFRESH_TIMEOUT_MS = 20_000;
const VIDEO_POLL_INTERVAL_MS = 1_500;

/**
 * Confirms the bytes landed.
 *
 * Bucket-backed materials are verified against storage. Video is not: it went to
 * the external host, so there is nothing in the bucket to look at. Instead the
 * host is polled until it reports the asset ready, and the playback id and
 * duration are written straight onto the material row.
 *
 * The webhook remains the better path and stays wired up, but it needs a webhook
 * secret registered with the host; without one, polling is what keeps a teacher's
 * upload from silently never appearing.
 */
export async function completeMaterialUploadAction(
  materialId: string,
  lessonId: string,
  courseId: string,
): Promise<StartUploadResult> {
  try {
    await finalizeMaterialUpload(materialId);

    const material = await getTeacherMaterial(materialId);
    let stillProcessing = false;

    if (material?.file_type === "video") {
      const outcome = await waitForVideoReady(materialId);
      if (outcome === "errored") {
        return {
          ok: false,
          error:
            "The video host could not process that file. It may not be a supported video format.",
        };
      }
      // "processing" is a success as far as the teacher is concerned: the bytes
      // landed and the host is still encoding. Reporting a failure here is what
      // previously told teachers their video had not worked.
      stillProcessing = outcome === "processing";
    }

    revalidatePath(`/teacher/courses/${courseId}/lessons/${lessonId}`);
    return {
      ok: true,
      materialId,
      uploadPath: "",
      token: "",
      providerUploadUrl: null,
      ...(stillProcessing ? { pending: true } : {}),
    };
  } catch (e) {
    return { ok: false, error: describe(e) };
  }
}

async function waitForVideoReady(
  materialId: string,
  timeoutMs = VIDEO_READY_TIMEOUT_MS,
): Promise<"ready" | "processing" | "errored"> {
  const uploadId = await getPendingUploadId(materialId);
  if (!uploadId) return "processing";

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const state = await pollDirectUpload(uploadId);

    if (state.status === "errored") return "errored";

    if (state.status === "ready") {
      await applyAssetReady(materialId, state);
      return "ready";
    }

    await new Promise((r) => setTimeout(r, VIDEO_POLL_INTERVAL_MS));
  }

  // Still encoding. The row keeps its asset id, so the video appears once the
  // host finishes rather than being reported as a failed upload.
  return "processing";
}

/**
 * Re-checks a video that is still encoding.
 *
 * The completion step waits 45 seconds, which is generous for a short clip but
 * not for a long recording. Without this, such a video stays "processing"
 * forever whenever the host webhook is not registered -- the row is written, the
 * upload id is on it, and nothing ever looks at it again. This gives the teacher
 * a way to pull the result, and it is also safe to call on a schedule.
 */
export async function refreshVideoMaterialAction(
  materialId: string,
  lessonId: string,
  courseId: string,
): Promise<
  | { ok: true; status: "ready" | "processing" | "errored" }
  | { ok: false; error: string }
> {
  try {
    // getTeacherMaterial is the authorisation check: it throws unless this
    // teacher owns the course the material hangs off.
    const material = await getTeacherMaterial(materialId);
    if (!material || material.file_type !== "video") {
      return { ok: false, error: "That material is not a video." };
    }

    const outcome = await waitForVideoReady(materialId, VIDEO_REFRESH_TIMEOUT_MS);
    revalidatePath(`/teacher/courses/${courseId}/lessons/${lessonId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    return { ok: true, status: outcome };
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
