import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { submitAdmissionApplication } from "@/services/admissions";

export const runtime = "nodejs";

/**
 * The public admission form's endpoint.
 *
 * This is the one write a signed-out visitor can reach. It takes the body as
 * JSON, hands it to the service (which is the only thing that parses and
 * writes), and answers with the generated reference. The slug comes from the
 * path, not the body, so the payload cannot choose which school it applies to.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json(
        { ok: false, error: "Send the application as a JSON object." },
        { status: 400 },
      );
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Send the application as JSON." },
      { status: 400 },
    );
  }

  try {
    const { applicationNumber } = await submitAdmissionApplication({ ...body, slug });
    return NextResponse.json({ ok: true, applicationNumber }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: error.issues[0]?.message ?? "Please check the form and try again." },
        { status: 400 },
      );
    }
    if (error instanceof Error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    console.error("admission application failed", error);
    return NextResponse.json(
      { ok: false, error: "We couldn't submit your application. Please try again." },
      { status: 500 },
    );
  }
}

export function GET() {
  return NextResponse.json({ error: "method not allowed" }, { status: 405 });
}
