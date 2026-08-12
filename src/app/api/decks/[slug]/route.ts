import { NextResponse } from "next/server";

import { getDeckResult } from "@/lib/data";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const result = await getDeckResult(slug);
  const meta = { source: result.source, degraded: result.degraded };

  if (!result.data) {
    return NextResponse.json(
      { message: "Không tìm thấy bộ từ.", meta },
      { status: 404 },
    );
  }

  return NextResponse.json({ deck: result.data, meta });
}
