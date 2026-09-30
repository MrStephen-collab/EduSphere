import { createHmac, createSign, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Video hosting for course material.
 *
 * Video deliberately does not live in the Supabase bucket: large lesson videos
 * would blow through storage limits and egress costs, and the real protection
 * we want is signed playback. Mux issues a playback token that is only valid
 * for one asset, one audience (`aud: "v"`), and a short window, and its own
 * logs record the token subject - so every playback session is attributable.
 *
 * Nothing here is required for documents, PDFs or audio, which stay in the
 * private Supabase bucket. If the Mux variables are absent, video uploads are
 * simply reported as unavailable instead of failing at playback time.
 */

const MUX_API = "https://api.mux.com";
const TOKEN_TTL_SECONDS = 300;

export const MUX_ENV_VARS = [
  "MUX_TOKEN_ID",
  "MUX_TOKEN_SECRET",
  "MUX_SIGNING_KEY_ID",
  "MUX_SIGNING_PRIVATE_KEY",
  "MUX_WEBHOOK_SECRET",
] as const;

export class VideoHostingUnavailableError extends Error {}

type MuxConfig = {
  tokenId: string;
  tokenSecret: string;
  signingKeyId: string;
  privateKey: string;
  webhookSecret: string;
};

function readConfig(): MuxConfig | null {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  const signingKeyId = process.env.MUX_SIGNING_KEY_ID;
  const privateKeyRaw = process.env.MUX_SIGNING_PRIVATE_KEY;
  const webhookSecret = process.env.MUX_WEBHOOK_SECRET;

  if (!tokenId || !tokenSecret || !signingKeyId || !privateKeyRaw) return null;

  return {
    tokenId,
    tokenSecret,
    signingKeyId,
    // Mux hands the key over base64-encoded PEM; accept either form.
    privateKey: privateKeyRaw.includes("BEGIN")
      ? privateKeyRaw
      : Buffer.from(privateKeyRaw, "base64").toString("utf8"),
    webhookSecret: webhookSecret ?? "",
  };
}

export function isVideoHostingConfigured(): boolean {
  return readConfig() !== null;
}

export function missingVideoHostingVars(): string[] {
  const missing: string[] = [];
  if (!process.env.MUX_TOKEN_ID) missing.push("MUX_TOKEN_ID");
  if (!process.env.MUX_TOKEN_SECRET) missing.push("MUX_TOKEN_SECRET");
  if (!process.env.MUX_SIGNING_KEY_ID) missing.push("MUX_SIGNING_KEY_ID");
  if (!process.env.MUX_SIGNING_PRIVATE_KEY) missing.push("MUX_SIGNING_PRIVATE_KEY");
  return missing;
}

function requireConfig(): MuxConfig {
  const config = readConfig();
  if (!config) {
    const missing = missingVideoHostingVars();
    throw new VideoHostingUnavailableError(
      `Video uploads are not configured yet (missing ${missing.join(", ")}). Documents, PDFs and audio still work.`,
    );
  }
  return config;
}

function authHeader(config: MuxConfig): string {
  return `Basic ${Buffer.from(`${config.tokenId}:${config.tokenSecret}`).toString("base64")}`;
}

// -----------------------------------------------------------------------------
// Uploads
// -----------------------------------------------------------------------------

export type DirectUpload = {
  uploadId: string;
  uploadUrl: string;
};

/**
 * Asks Mux for a one-time upload URL. The teacher's browser PUTs the file
 * straight to Mux, so the video never passes through the Next.js server.
 *
 * `playback_policies: ["signed"]` is what makes the resulting asset private:
 * without a valid token the stream URL returns 403.
 */
export async function createDirectUpload(
  appUrl: string,
  passthrough: string,
): Promise<DirectUpload> {
  const config = requireConfig();

  const response = await fetch(`${MUX_API}/video/v1/uploads`, {
    method: "POST",
    headers: {
      Authorization: authHeader(config),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cors_origin: appUrl,
      new_asset_settings: {
        playback_policies: ["signed"],
        max_resolution_tier: "1080p",
        video_quality: "basic",
        // A plain progressive MP4 alongside the HLS manifests. It plays in
        // every browser with a bare <video> element, so course video still
        // works without pulling in an HLS library.
        static_renditions: [{ resolution: "highest" }],
        // Echoed back on the webhook so we can match the asset to its row.
        passthrough,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    // 403 here is almost always a scope problem, and the raw Mux message
    // ("insufficient_scope") is not something a teacher can act on.
    if (response.status === 403) {
      throw new Error(
        "The video host rejected the upload request: the access token is missing the Mux Video Write scope.",
      );
    }
    throw new Error(`The video host rejected the upload request (${response.status}): ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as { data: { id: string; url: string } };
  return { uploadId: payload.data.id, uploadUrl: payload.data.url };
}

export async function deleteRemoteAsset(assetId: string): Promise<void> {
  const config = readConfig();
  if (!config) return;
  // A token without Video Write scope answers 403 here. Swallowing that would
  // report a successful delete while the asset is still live on Mux and still
  // reachable by anyone holding a playback URL, so surface it instead.
  const response = await fetch(`${MUX_API}/video/v1/assets/${assetId}`, {
    method: "DELETE",
    headers: { Authorization: authHeader(config) },
  }).catch(() => null);

  if (response && !response.ok) {
    throw new Error(`The video host refused to delete this video (${response.status}). Check that the access token has Mux Video Write.`);
  }
}

// -----------------------------------------------------------------------------
// Signed playback
// -----------------------------------------------------------------------------

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** RS256 JWT, signed with Node's crypto so we take on no JWT dependency. */
function signJwt(payload: Record<string, unknown>, config: MuxConfig): string {
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: config.signingKeyId }));
  const body = base64Url(JSON.stringify(payload));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${body}`);
  const signature = signer.sign(config.privateKey);
  return `${header}.${body}.${base64Url(signature)}`;
}

export type PlaybackGrant = {
  /** Progressive MP4, plays natively in every browser. */
  streamUrl: string;
  /** Adaptive HLS manifest, for when an HLS-capable player is in use. */
  hlsUrl: string;
  token: string;
  expiresAt: string;
  watermarkLabel: string;
};

/**
 * Mints a playback token for one student and one asset.
 *
 * `sub` must be the playback id: Mux authorises a signed request by matching
 * `sub` against the asset the stream URL names, so a token carrying a user id
 * here is rejected with 403. The student is not identified to Mux in the token
 * at all -- attribution comes from our own `video_access_log` row written
 * alongside this call, and from the on-screen watermark, which name the same
 * learner. That is what the forensic trail actually rests on.
 *
 * `aud: "v"` selects video tokens. No other claim may narrow this further
 * without Mux-side support, so the grant is bounded by the playback id and the
 * 5-minute expiry.
 *
 * A signed URL must carry nothing but the `token` parameter - any other
 * modifier has to be a claim inside the JWT, so the stream URLs below are
 * built with the token alone.
 */
export function mintPlaybackToken(
  playbackId: string,
  viewer: { id: string; name: string },
  now: number = Date.now(),
): PlaybackGrant {
  const config = requireConfig();
  const expiresAtSeconds = Math.floor(now / 1000) + TOKEN_TTL_SECONDS;

  const token = signJwt(
    {
      sub: playbackId,
      aud: "v",
      exp: expiresAtSeconds,
      kid: config.signingKeyId,
    },
    config,
  );

  return {
    streamUrl: `https://stream.mux.com/${playbackId}/highest.mp4?token=${token}`,
    hlsUrl: `https://stream.mux.com/${playbackId}.m3u8?token=${token}`,
    token,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
    watermarkLabel: `${viewer.name} · ${viewer.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
  };
}

// -----------------------------------------------------------------------------
// Webhooks
// -----------------------------------------------------------------------------

/**
 * Verifies a Mux webhook using the `mux-signature` header, which carries
 * `t=<unix>,v1=<hmac>` where the HMAC covers "<timestamp>.<raw body>".
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds = 300,
): boolean {
  if (!signatureHeader || !secret) return false;

  const parts = new Map(
    signatureHeader.split(",").map((pair) => {
      const [key, value] = pair.split("=");
      return [key?.trim(), value?.trim()];
    }),
  );

  const timestamp = parts.get("t");
  const provided = parts.get("v1");
  if (!timestamp || !provided) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type MuxWebhookEvent = {
  type: string;
  data: {
    id: string;
    passthrough?: string;
    duration?: number;
    playback_ids?: { id: string; policy: string }[];
    status?: string;
  };
};

export async function recordAssetReady(event: MuxWebhookEvent): Promise<void> {
  if (event.type !== "video.asset.ready") return;

  const passthrough = event.data.passthrough;
  if (!passthrough) return;

  // passthrough carries the material id minted at upload time.
  const { materialId } = parsePassthrough(passthrough);
  if (!materialId) return;

  const playbackId = event.data.playback_ids?.find((p) => p.policy === "signed")?.id;

  const admin = createAdminClient();
  await admin
    .from("lesson_materials")
    .update({
      provider: "mux",
      provider_asset_id: event.data.id,
      provider_playback_id: playbackId ?? null,
      duration_seconds: event.data.duration
        ? Math.round(event.data.duration)
        : null,
    })
    .eq("id", materialId);
}

export async function recordAssetErrored(event: MuxWebhookEvent): Promise<void> {
  if (event.type !== "video.asset.errored") return;
  const { materialId } = parsePassthrough(event.data.passthrough ?? "");
  if (!materialId) return;

  const admin = createAdminClient();
  await admin.from("lesson_materials").delete().eq("id", materialId);
}

function parsePassthrough(value: string): { materialId: string | null } {
  const [key, id] = value.split(":");
  if (key !== "material" || !id) return { materialId: null };
  return { materialId: /^[0-9a-f-]{36}$/i.test(id) ? id : null };
}

export function buildPassthrough(materialId: string): string {
  return `material:${materialId}`;
}
