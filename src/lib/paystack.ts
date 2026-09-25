import { createHmac } from "node:crypto";

const PAYSTACK_API = "https://api.paystack.co";

export function isPaystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

function secret(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("Paystack isn't configured on this server yet.");
  return key;
}

class PaystackError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function paystackFetch(
  path: string,
  options: { method?: "POST" | "GET"; body?: unknown } = {},
): Promise<{ data: Record<string, unknown> }> {
  const res = await fetch(`${PAYSTACK_API}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const body = (await res.json().catch(() => null)) as {
    status?: boolean;
    message?: string;
    data?: Record<string, unknown>;
  } | null;

  if (!res.ok || body?.status !== true) {
    throw new PaystackError(
      body?.message ?? "Paystack returned an error.",
      res.status,
    );
  }
  return { data: (body?.data ?? {}) as Record<string, unknown> };
}

export type InitializePaymentInput = {
  email: string;
  amountMinor: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
};

export async function initializePayment(
  input: InitializePaymentInput,
): Promise<{ reference: string; authorizationUrl: string }> {
  const { data } = await paystackFetch("/transaction/initialize", {
    method: "POST",
    body: {
      email: input.email,
      amount: input.amountMinor,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata ?? {},
    },
  });
  const authorizationUrl = data?.authorization_url as string | undefined;
  if (!authorizationUrl) {
    throw new PaystackError("Paystack didn't return a checkout link.");
  }
  return { reference: input.reference, authorizationUrl };
}

export type VerifiedPayment = {
  status: string;
  amountMinor: number | null;
  paidAt: string | null;
};

export async function verifyPayment(reference: string): Promise<VerifiedPayment> {
  const { data } = await paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`);
  const amount = typeof data?.amount === "number" ? data.amount : null;
  const paidAt =
    typeof data?.paid_at === "string" && data.paid_at ? data.paid_at : null;
  return {
    status: typeof data?.status === "string" ? data.status : "unknown",
    amountMinor: amount,
    paidAt,
  };
}

export async function refundPayment(reference: string): Promise<void> {
  await paystackFetch("/refund", {
    method: "POST",
    body: { transaction: reference },
  });
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  if (!signature) return false;
  const hmac = createHmac("sha512", secret());
  hmac.update(rawBody, "utf8");
  const expected = hmac.digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return a.compare(b) === 0;
}