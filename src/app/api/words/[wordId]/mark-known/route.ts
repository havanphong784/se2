import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb, isDatabaseCoolingDown, markDatabaseAvailable, markDatabaseFailure } from "@/db";
import { wordProgress, words } from "@/db/schema";
import { getDemoUser, isUuid } from "@/lib/server-data";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ wordId: string }> },
) {
  const { wordId } = await params;
  if (!isUuid(wordId)) {
    return NextResponse.json({ message: "ID từ không hợp lệ." }, { status: 400 });
  }

  const db = getDb();
  if (!db || isDatabaseCoolingDown()) {
    return NextResponse.json({ message: "Cơ sở dữ liệu chưa sẵn sàng." }, { status: 503 });
  }

  try {
    const user = await getDemoUser(db);
    if (!user) {
      return NextResponse.json({ message: "Không tìm thấy người dùng." }, { status: 401 });
    }

    // Verify word exists
    const [word] = await db
      .select({ id: words.id })
      .from(words)
      .where(eq(words.id, wordId))
      .limit(1);

    if (!word) {
      return NextResponse.json({ message: "Không tìm thấy từ." }, { status: 404 });
    }

    const now = new Date();

    // Upsert word_progress to mastered
    const [existing] = await db
      .select({ id: wordProgress.id })
      .from(wordProgress)
      .where(and(eq(wordProgress.userId, user.id), eq(wordProgress.wordId, wordId)))
      .limit(1);

    if (existing) {
      await db
        .update(wordProgress)
        .set({
          status: "mastered",
          mastery: 100,
          reviewStage: 3,
          reviewCompletedAt: now,
          learnedAt: now,
          updatedAt: now,
        })
        .where(eq(wordProgress.id, existing.id));
    } else {
      await db.insert(wordProgress).values({
        userId: user.id,
        wordId,
        status: "mastered",
        mastery: 100,
        intervalDays: 0,
        correctCount: 0,
        incorrectCount: 0,
        reviewStage: 3,
        reviewCompletedAt: now,
        learnedAt: now,
        updatedAt: now,
      });
    }

    markDatabaseAvailable();
    return NextResponse.json({ success: true, wordId, status: "mastered" });
  } catch (error) {
    markDatabaseFailure(error);
    return NextResponse.json({ message: "Không thể đánh dấu từ đã thuộc." }, { status: 503 });
  }
}
