import { NextResponse } from "next/server";

import { getLearningData } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const learning = await getLearningData();
  return NextResponse.json({
    streak: learning.data.streak,
    source: learning.source,
  });
}
