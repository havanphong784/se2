import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { requireAuth } from "@/lib/auth";
import { getDecksResult } from "@/lib/data";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ message: "Cơ sở dữ liệu chưa sẵn sàng." }, { status: 503 });
  const user = await requireAuth(request, db);
  if (!user) return NextResponse.json({ message: "Chưa xác thực." }, { status: 401 });

  const result = await getDecksResult(user.id);
  return NextResponse.json({ decks: result.data, meta: { source: result.source, degraded: result.degraded } });
}
