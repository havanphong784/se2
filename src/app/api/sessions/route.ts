import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ message: "Cơ sở dữ liệu chưa sẵn sàng." }, { status: 503 });
  if (!(await requireAuth(request, db))) return NextResponse.json({ message: "Chưa xác thực." }, { status: 401 });
  return NextResponse.json(
    { message: "API đánh giá flashcard cũ đã ngừng hoạt động. Hãy dùng API phiên học." },
    { status: 410 },
  );
}
