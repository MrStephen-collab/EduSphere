import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import { isFeeReference } from "@/lib/fee-math";
import { confirmPaystackPayment } from "@/services/billing";
import { confirmFeePayment } from "@/services/fees";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: {
    event?: string;
    data?: { reference?: string; amounts?: unknown };
  } | null = null;
  try {
    event = JSON.parse(rawBody) as {
      event?: string;
      data?: { reference?: string; amounts?: unknown };
    };
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  if (!event) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const reference = event?.data?.reference;
  if (!reference) {
    return NextResponse.json({ received: true });
  }

  try {
    if (event.event === "charge.success") {
      // One Paystack account serves both ledgers. School subscriptions are
      // settled the moment money is verified; a fee payment is only queued for
      // a bursar, so the two need different handling and the reference prefix is
      // what tells them apart.
      if (isFeeReference(reference)) {
        await confirmFeePayment(reference);
      } else {
        await confirmPaystackPayment(reference);
      }
    }
  } catch (error) {
    console.error("Paystack webhook processing failed:", error);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

export function GET() {
  return NextResponse.json({ error: "method not allowed" }, { status: 405 });
}