import { NextResponse } from "next/server";

import { getDb, isDatabaseCoolingDown, markDatabaseFailure } from "@/db";
import { requireAuth } from "@/lib/auth";
import { isUuid } from "@/lib/server-data";
import { StudyServiceError, submitStudyEvent } from "@/lib/study-service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const body = (await request.json().catch(() => null)) as {
    eventId?: unknown;
    wordId?: unknown;
    answer?: unknown;
    incorrectAttemptCount?: unknown;
    isCorrect?: unknown;
  } | null;

  if (
    !isUuid(sessionId) ||
    !body ||
    typeof body.eventId !== "string" ||
    !isUuid(body.eventId) ||
    typeof body.wordId !== "string" ||
    !isUuid(body.wordId) ||
    typeof body.answer !== "string" ||
    body.answer.length > 256 ||
    typeof body.incorrectAttemptCount !== "number" ||
    !Number.isSafeInteger(body.incorrectAttemptCount) ||
    body.incorrectAttemptCount < 0 ||
    body.incorrectAttemptCount > 1_000 ||
    typeof body.isCorrect !== "boolean"
  ) {
    return NextResponse.json({ message: "Dữ liệu lượt học không hợp lệ." }, { status: 400 });
  }

  const db = getDb();
  if (!db || isDatabaseCoolingDown()) {
    return NextResponse.json({ message: "Cơ sở dữ liệu chưa sẵn sàng." }, { status: 503 });
  }
  const user = await requireAuth(request, db);
  if (!user) return NextResponse.json({ message: "Chưa xác thực." }, { status: 401 });

  try {
    await submitStudyEvent(
      db,
      {
        sessionId,
        eventId: body.eventId,
        wordId: body.wordId,
        answer: body.answer,
        incorrectAttemptCount: body.incorrectAttemptCount,
        isCorrect: body.isCorrect,
      },
      user.id,
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof StudyServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    markDatabaseFailure(error);
    return NextResponse.json({ message: "Không thể lưu lượt học." }, { status: 503 });
  }
}
