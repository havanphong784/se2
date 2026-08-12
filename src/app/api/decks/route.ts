import { NextResponse } from "next/server";

import { getDecksResult } from "@/lib/data";

export const runtime = "nodejs";

export async function GET() {
  const result = await getDecksResult();
  return NextResponse.json({
    decks: result.data,
    meta: { source: result.source, degraded: result.degraded },
  });
}
