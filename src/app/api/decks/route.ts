import { NextResponse } from "next/server";

import { getDecks } from "@/lib/data";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ decks: await getDecks() });
}
