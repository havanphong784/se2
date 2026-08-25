import { NextResponse } from "next/server";

import { getDb, isDatabaseCoolingDown, markDatabaseFailure } from "@/db";
import { requireAuth } from "@/lib/auth";
import { isUuid } from "@/lib/server-data";
import { createStudySession, StudyServiceError } from "@/lib/study-service";
import { SESSION_SIZES, type SessionSize, type StudyMode } from "@/lib/study";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    mode?: unknown;
    deckId?: unknown;
    deckSlug?: unknown;
    requestedSize?: unknown;
  } | null;
  const mode = body?.mode;
  const requestedSize = body?.requestedSize;
  if (!body || (mode !== "learn" && mode !== "review") || typeof requestedSize !== "number" ||
    !SESSION_SIZES.includes(requestedSize as SessionSize) ||
    (mode === "learn" &&
      ((typeof body.deckId !== "string" || !isUuid(body.deckId)) &&
        (typeof body.deckSlug !== "string" || !body.deckSlug || body.deckSlug.length > 160)))) {
    return NextResponse.json({ message: "Cấu hình phiên học không hợp lệ." }, { status: 400 });
  }

  const db = getDb();
  if (!db || isDatabaseCoolingDown()) {
    return NextResponse.json({ message: "Cơ sở dữ liệu đang tạm thời không truy cập được." }, { status: 503 });
  }
  const user = await requireAuth(request, db);
  if (!user) return NextResponse.json({ message: "Chưa xác thực." }, { status: 401 });

  try {
    const session = await createStudySession(db, {
      mode: mode as StudyMode,
      deckId:
        typeof body.deckId === "string" && isUuid(body.deckId) ? body.deckId : undefined,
      deckSlug: typeof body.deckSlug === "string" ? body.deckSlug : undefined,
      requestedSize: requestedSize as SessionSize,
    }, user.id);
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    if (error instanceof StudyServiceError) return NextResponse.json({ message: error.message }, { status: error.status });
    markDatabaseFailure(error);
    return NextResponse.json({ message: "Không thể tạo phiên học lúc này." }, { status: 503 });
  }
}
