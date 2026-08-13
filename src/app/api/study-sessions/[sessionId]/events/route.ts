import { NextResponse } from "next/server";

import { getDb, isDatabaseCoolingDown, markDatabaseFailure } from "@/db";
import { isUuid } from "@/lib/server-data";
import { StudyServiceError, submitStudyEvent } from "@/lib/study-service";
import type { StudyPhase } from "@/lib/study";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const body = (await request.json().catch(() => null)) as {
    eventId?: unknown;
    wordId?: unknown;
    phase?: unknown;
    selectedWordId?: unknown;
    answer?: unknown;
  } | null;
  const phases: StudyPhase[] = ["flashcard", "multiple_choice", "typing"];
  if (
    !isUuid(sessionId) ||
    !body ||
    typeof body.eventId !== "string" ||
    !isUuid(body.eventId) ||
    typeof body.wordId !== "string" ||
    !isUuid(body.wordId) ||
    typeof body.phase !== "string" ||
    !phases.includes(body.phase as StudyPhase) ||
    (body.phase === "multiple_choice" &&
      (typeof body.selectedWordId !== "string" || !isUuid(body.selectedWordId))) ||
    (body.phase === "typing" &&
      (typeof body.answer !== "string" || body.answer.length > 256))
  ) {
    return NextResponse.json({ message: "Dữ liệu lượt học không hợp lệ." }, { status: 400 });
  }

  const db = getDb();
  if (!db || isDatabaseCoolingDown()) {
    return NextResponse.json({ message: "Cơ sở dữ liệu chưa sẵn sàng." }, { status: 503 });
  }
  try {
    const submitted = await submitStudyEvent(db, {
      sessionId,
      eventId: body.eventId,
      wordId: body.wordId,
      phase: body.phase as StudyPhase,
      selectedWordId:
        typeof body.selectedWordId === "string" ? body.selectedWordId : undefined,
      answer: typeof body.answer === "string" ? body.answer : undefined,
    });
    return NextResponse.json(submitted);
  } catch (error) {
    if (error instanceof StudyServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    markDatabaseFailure(error);
    return NextResponse.json({ message: "Không thể lưu lượt học." }, { status: 503 });
  }
}
