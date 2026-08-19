import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { requireAuth } from "@/lib/auth";
import { getDeckResult } from "@/lib/data";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const db = getDb();
  if (!db) return NextResponse.json({ message: "Cơ sở dữ liệu chưa sẵn sàng." }, { status: 503 });
  const user = await requireAuth(request, db);
  if (!user) return NextResponse.json({ message: "Chưa xác thực." }, { status: 401 });

  const { slug } = await params;
  const result = await getDeckResult(slug, user.id);
  const meta = { source: result.source, degraded: result.degraded };
  if (!result.data) return NextResponse.json({ message: "Không tìm thấy bộ từ.", meta }, { status: 404 });
  return NextResponse.json({ deck: result.data, meta });
}
