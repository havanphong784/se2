import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { requireAuth } from "@/lib/auth";
import { getLearningData } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ message: "Cơ sở dữ liệu chưa sẵn sàng." }, { status: 503 });
  const user = await requireAuth(request, db);
  if (!user) return NextResponse.json({ message: "Chưa xác thực." }, { status: 401 });

  const learning = await getLearningData(user.id);
  return NextResponse.json({
    data: learning.data,
    source: learning.source,
    user: { id: user.id, displayName: user.displayName, email: user.email },
  });
}
