import { NextResponse } from "next/server";
import {
  recordAssetErrored,
  recordAssetReady,
  verifyWebhookSignature,
  type MuxWebhookEvent,
} from "@/services/video-hosting";

export const runtime = "nodejs";

/**
 * Receives video-host webhooks so a freshly uploaded video gets its asset and
 * signed-playback ids attached to its material row.
 *
 * The body is read as raw text because the signature covers the exact bytes
 * sent; parsing to JSON first would break verification.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("mux-signature");

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: MuxWebhookEvent;
  try {
    event = JSON.parse(rawBody) as MuxWebhookEvent;
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  if (event.type === "video.asset.ready") {
    await recordAssetReady(event);
  } else if (event.type === "video.asset.errored") {
    await recordAssetErrored(event);
  }

  return NextResponse.json({ received: true });
}
