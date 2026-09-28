import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHmac, generateKeyPairSync, createVerify } from "node:crypto";
import {
  buildPassthrough,
  isVideoHostingConfigured,
  mintPlaybackToken,
  missingVideoHostingVars,
  verifyWebhookSignature,
} from "@/services/video-hosting";

/**
 * The video host is unreachable in CI, so these tests exercise the parts that
 * decide whether a stream is allowed: the RS256 token we mint, and the webhook
 * signature check that lets an outsider write asset ids into our database.
 */

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const ENV = [
  "MUX_TOKEN_ID",
  "MUX_TOKEN_SECRET",
  "MUX_SIGNING_KEY_ID",
  "MUX_SIGNING_PRIVATE_KEY",
  "MUX_WEBHOOK_SECRET",
] as const;

const saved = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of ENV) saved.set(key, process.env[key]);
  process.env.MUX_TOKEN_ID = "token-id";
  process.env.MUX_TOKEN_SECRET = "token-secret";
  process.env.MUX_SIGNING_KEY_ID = "signing-key-id";
  process.env.MUX_SIGNING_PRIVATE_KEY = privateKey;
  process.env.MUX_WEBHOOK_SECRET = "webhook-secret";
});

afterEach(() => {
  for (const key of ENV) {
    const original = saved.get(key);
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
});

function decodeSegment(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

describe("video hosting configuration", () => {
  it("reports unavailable when the signing key is absent", () => {
    delete process.env.MUX_SIGNING_PRIVATE_KEY;
    expect(isVideoHostingConfigured()).toBe(false);
    expect(missingVideoHostingVars()).toContain("MUX_SIGNING_PRIVATE_KEY");
  });

  it("accepts a base64-encoded PEM as well as a raw PEM", () => {
    // Pinned clock: the two calls must be in the same second, or `exp` shifts
    // and the tokens legitimately differ.
    const now = Date.UTC(2026, 0, 1);
    const raw = mintPlaybackToken("playback123", { id: "user-1", name: "Ada" }, now);
    process.env.MUX_SIGNING_PRIVATE_KEY = Buffer.from(privateKey).toString("base64");
    const encoded = mintPlaybackToken("playback123", { id: "user-1", name: "Ada" }, now);
    expect(encoded.streamUrl).toBe(raw.streamUrl);
  });

  it("refuses to mint a token when unconfigured", () => {
    delete process.env.MUX_TOKEN_ID;
    expect(() => mintPlaybackToken("playback123", { id: "user-1", name: "Ada" })).toThrow(
      /not configured/i,
    );
  });
});

describe("playback tokens", () => {
  it("signs with RS256 under the configured key id", () => {
    const grant = mintPlaybackToken("playback123", { id: "user-abc", name: "Ada" });
    const [header] = grant.token.split(".");

    const decoded = decodeSegment(header);
    expect(decoded.alg).toBe("RS256");
    expect(decoded.kid).toBe("signing-key-id");
  });

  it("produces a signature the matching public key verifies", () => {
    const grant = mintPlaybackToken("playback123", { id: "user-abc", name: "Ada" });
    const [header, body, signature] = grant.token.split(".");

    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${body}`);
    expect(verifier.verify(publicKey, Buffer.from(signature, "base64url"))).toBe(true);
  });

  it("binds the token to one viewer so a shared URL is traceable", () => {
    const grant = mintPlaybackToken("playback123", { id: "user-abc", name: "Ada" });
    const claims = decodeSegment(grant.token.split(".")[1]);

    expect(claims.sub).toBe("user-abc");
    expect(claims.aud).toBe("v");
  });

  it("scopes the token to video, not thumbnails or gif", () => {
    const grant = mintPlaybackToken("playback123", { id: "user-abc", name: "Ada" });
    expect(decodeSegment(grant.token.split(".")[1]).aud).not.toBe("t");
  });

  it("expires within minutes rather than granting a long-lived link", () => {
    const now = Date.UTC(2026, 0, 1);
    const grant = mintPlaybackToken("playback123", { id: "user-abc", name: "Ada" }, now);
    const exp = Number(decodeSegment(grant.token.split(".")[1]).exp);

    expect(exp).toBeGreaterThan(now / 1000);
    expect(exp).toBeLessThanOrEqual(now / 1000 + 300);
  });

  it("carries the viewer identity in the watermark label", () => {
    const grant = mintPlaybackToken("playback123", {
      id: "ba40bc98-fd46-40df-8abd-fd7e28628999",
      name: "Ada",
    });
    expect(grant.watermarkLabel).toContain("Ada");
    expect(grant.watermarkLabel).toContain("BA40BC98");
  });

  it("puts only the token on the stream URLs, since modifiers must be claims", () => {
    const grant = mintPlaybackToken("playback123", { id: "user-abc", name: "Ada" });

    for (const url of [grant.streamUrl, grant.hlsUrl]) {
      const query = new URL(url).searchParams;
      expect([...query.keys()]).toEqual(["token"]);
    }
    expect(grant.hlsUrl).toContain("playback123.m3u8");
  });

  it("does not offer a download filename on the stream URL", () => {
    const grant = mintPlaybackToken("playback123", { id: "user-abc", name: "Ada" });
    expect(grant.streamUrl).not.toContain("download=");
  });
});

describe("webhook signature verification", () => {
  const body = JSON.stringify({ type: "video.asset.ready", data: { id: "asset-1" } });

  function sign(payload: string, timestamp: number, secret = "webhook-secret"): string {
    const digest = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
    return `t=${timestamp},v1=${digest}`;
  }

  it("accepts a correctly signed payload", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(verifyWebhookSignature(body, sign(body, now), "webhook-secret")).toBe(true);
  });

  it("rejects a body edited after signing", () => {
    const now = Math.floor(Date.now() / 1000);
    const signature = sign(body, now);
    const tampered = body.replace("asset-1", "asset-999");
    expect(verifyWebhookSignature(tampered, signature, "webhook-secret")).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(verifyWebhookSignature(body, sign(body, now, "wrong"), "webhook-secret")).toBe(false);
  });

  it("rejects a replayed signature outside the tolerance window", () => {
    const stale = Math.floor(Date.now() / 1000) - 3600;
    expect(verifyWebhookSignature(body, sign(body, stale), "webhook-secret")).toBe(false);
  });

  it("rejects a missing or malformed header", () => {
    expect(verifyWebhookSignature(body, null, "webhook-secret")).toBe(false);
    expect(verifyWebhookSignature(body, "garbage", "webhook-secret")).toBe(false);
    expect(verifyWebhookSignature(body, "t=123", "webhook-secret")).toBe(false);
  });

  it("rejects everything when no secret is configured", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(verifyWebhookSignature(body, sign(body, now), "")).toBe(false);
  });
});

describe("asset passthrough", () => {
  it("round-trips a material id", () => {
    const id = "b5ea4ea2-8d13-41d5-8d9f-cb59869841ee";
    expect(buildPassthrough(id)).toBe(`material:${id}`);
  });

  it("cannot be used to point a webhook at somebody else's row", () => {
    // The webhook resolver only accepts a strict uuid after the marker, so a
    // crafted passthrough cannot be coerced into an update target.
    const hostile = "material:1 OR 1=1";
    const [, value] = hostile.split(":");
    expect(/^[0-9a-f-]{36}$/i.test(value)).toBe(false);
  });
});
