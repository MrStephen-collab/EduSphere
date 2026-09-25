import { NextRequest, NextResponse } from "next/server";
import { runSearch } from "@/services/search";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ groups: [] });
  }

  try {
    const groups = await runSearch(q);
    return NextResponse.json({ groups });
  } catch (error) {
    console.error("Search failed:", error);
    return NextResponse.json({ groups: [] }, { status: 500 });
  }
}

export function POST() {
  return NextResponse.json({ error: "method not allowed" }, { status: 405 });
}