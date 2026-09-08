import { NextResponse } from "next/server";

import { getDb, isDatabaseCoolingDown, markDatabaseFailure } from "@/db";
import { requireAuth } from "@/lib/auth";
import { isUuid } from "@/lib/server-data";
import { abandonStudySession, StudyServiceError } from "@/lib/study-service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) return NextResponse.json({ message: "Mã phiên học không hợp lệ." }, { status: 400 });
  const db = getDb();
  if (!db || isDatabaseCoolingDown()) return NextResponse.json({ message: "Cơ sở dữ liệu chưa sẵn sàng." }, { status: 503 });
  const user = await requireAuth(request, db);
  if (!user) return NextResponse.json({ message: "Chưa xác thực." }, { status: 401 });
  try {
    return NextResponse.json({ session: await abandonStudySession(db, sessionId, user.id) });
  } catch (error) {
    if (error instanceof StudyServiceError) return NextResponse.json({ message: error.message }, { status: error.status });
    markDatabaseFailure(error);
    return NextResponse.json({ message: "Không thể đóng phiên học." }, { status: 503 });
  }
}
