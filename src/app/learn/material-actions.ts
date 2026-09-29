"use server";

import {
  authorizeVideoPlayback,
  recordPlaybackAccess,
  requestMaterialAccess,
  MaterialAccessError,
  type MaterialAccessGrant,
} from "@/services/material-storage";
import { mintPlaybackToken, VideoHostingUnavailableError } from "@/services/video-hosting";

export type PlaybackState =
  | {
      ok: true;
      streamUrl: string;
      expiresAt: string;
      /** Rendered into the on-screen watermark and matched against the log. */
      watermark: string;
    }
  | { ok: false; error: string };

function describe(e: unknown): string {
  if (e instanceof MaterialAccessError) return e.message;
  if (e instanceof VideoHostingUnavailableError) return e.message;
  return e instanceof Error ? e.message : "We couldn't open that material.";
}

/**
 * Returns a short-lived read grant for one material.
 *
 * Private-bucket files come back as a signed URL that expires in minutes.
 * Hosted video comes back as a signed HLS manifest whose token is bound to
 * this viewer, and the grant is written to the forensic log first.
 */
export async function requestMaterialAccessAction(
  materialId: string,
): Promise<
  | { ok: true; grant: MaterialAccessGrant }
  | { ok: false; error: string }
> {
  try {
    const grant = await requestMaterialAccess(materialId);
    return { ok: true, grant };
  } catch (e) {
    return { ok: false, error: describe(e) };
  }
}

/**
 * Signs a playback token for a single student and records the attempt.
 *
 * The log row is written before the token is handed back, so a stream session
 * that shows up in the video host's logs always has a matching entry naming the
 * learner, the lesson and the time.
 *
 * `tokenSubject` is the token's own `sub` claim, which is the playback id, so a
 * provider log line keys straight to `playback_id` on this row and from there to
 * `viewer_id`. It deliberately does not carry the user id: the token no longer
 * claims one, and a column named after the claim must not report a value the
 * token does not contain.
 */
export async function requestVideoPlaybackAction(
  materialId: string,
): Promise<PlaybackState> {
  try {
    const auth = await authorizeVideoPlayback(materialId);

    const grant = mintPlaybackToken(auth.playbackId, {
      id: auth.viewerId,
      name: auth.viewerName,
    });

    await recordPlaybackAccess({
      schoolId: auth.schoolId,
      materialId: auth.material.id,
      lessonId: auth.material.lesson_id,
      viewerId: auth.viewerId,
      viewerRole: auth.viewerRole,
      provider: auth.material.provider ?? "mux",
      assetId: auth.material.provider_asset_id,
      playbackId: auth.playbackId,
      tokenSubject: auth.playbackId,
    });

    return {
      ok: true,
      streamUrl: grant.streamUrl,
      expiresAt: grant.expiresAt,
      watermark: grant.watermarkLabel,
    };
  } catch (e) {
    return { ok: false, error: describe(e) };
  }
}
