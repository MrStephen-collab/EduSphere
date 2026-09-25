import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import { confirmPaystackPayment } from "@/services/billing";

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
      await confirmPaystackPayment(reference);
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