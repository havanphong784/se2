import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb, isDatabaseCoolingDown, markDatabaseFailure } from "@/db";
import { wordProgress, words } from "@/db/schema";
import { getDemoUser, isUuid } from "@/lib/server-data";
import {
  computeMastery,
  computeNextReview,
  computeWordStatus,
  type Rating,
} from "@/lib/study";

export const runtime = "nodejs";

type ProgressPayload = {
  wordId?: unknown;
  rating?: unknown;
  intervalDays?: unknown;
};

const ratings: Rating[] = ["again", "hard", "good"];

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ProgressPayload | null;
  const wordId = body?.wordId;
  if (
    !body ||
    typeof wordId !== "string" ||
    typeof body.rating !== "string" ||
    !ratings.includes(body.rating as Rating)
  ) {
    return NextResponse.json(
      { message: "Dữ liệu đánh giá không hợp lệ." },
      { status: 400 },
    );
  }

  const db = getDb();
  const now = new Date();
  const rating = body.rating as Rating;
  const offlineInterval =
    typeof body.intervalDays === "number" &&
    Number.isFinite(body.intervalDays) &&
    Number.isInteger(body.intervalDays) &&
    body.intervalDays >= 0
      ? body.intervalDays
      : 0;

  if (!db) {
    const next = computeNextReview({ intervalDays: offlineInterval }, rating, now);
    return NextResponse.json({
      ...next,
      persisted: false,
      reason: "database_not_configured",
    });
  }

  if (!isUuid(wordId)) {
    return NextResponse.json(
      { message: "Dữ liệu đánh giá không hợp lệ." },
      { status: 400 },
    );
  }

  if (isDatabaseCoolingDown()) {
    return NextResponse.json(
      {
        message: "Cơ sở dữ liệu đang tạm thời không truy cập được.",
        persisted: false,
        reason: "database_unavailable",
      },
      { status: 503 },
    );
  }

  try {
    const [user, word] = await Promise.all([
      getDemoUser(db),
      db.select({ id: words.id }).from(words).where(eq(words.id, wordId)).limit(1),
    ]);

    if (!user) {
      return NextResponse.json(
        { message: "Hãy chạy pnpm db:seed trước khi lưu tiến độ." },
        { status: 503 },
      );
    }
    if (!word.length) {
      return NextResponse.json({ message: "Không tìm thấy từ cần ôn." }, { status: 404 });
    }

    const intervalExpression =
      rating === "again"
        ? sql`0`
        : rating === "hard"
          ? sql`greatest(1, ceil(${wordProgress.intervalDays} * 1.5)::integer)`
          : sql`case when ${wordProgress.intervalDays} = 0 then 1 when ${wordProgress.intervalDays} = 1 then 3 else ${wordProgress.intervalDays} * 2 end`;
    const masteryExpression =
      rating === "again"
        ? sql`case
            when ${wordProgress.mastery} >= 80 then ${wordProgress.mastery} - 10
            when ${wordProgress.mastery} >= 60 then ${wordProgress.mastery} - 20
            else greatest(0, ${wordProgress.mastery} - 30)
          end`
        : sql`least(100, ${wordProgress.mastery} + ${rating === "hard" ? 6 : 16})`;
    const statusExpression = sql`case
      when ${masteryExpression} >= 80 then 'mastered'
      when ${wordProgress.status} = 'mastered' and ${masteryExpression} >= 60 then 'mastered'
      when ${masteryExpression} > 0 then 'learning'
      else 'new'
    end`;
    const nextReviewExpression =
      rating === "again"
        ? sql`${now.toISOString()}::timestamptz + interval '10 minutes'`
        : sql`${now.toISOString()}::timestamptz + (${intervalExpression} * interval '1 day')`;

    const initialNext = computeNextReview({ intervalDays: 0 }, rating, now);
    const initialMastery = computeMastery(0, rating);
    const initialStatus = computeWordStatus("new", initialMastery);

    const [saved] = await db
      .insert(wordProgress)
      .values({
        userId: user.id,
        wordId,
        status: initialStatus,
        mastery: initialMastery,
        intervalDays: initialNext.intervalDays,
        correctCount: rating === "again" ? 0 : 1,
        incorrectCount: rating === "again" ? 1 : 0,
        lastReviewedAt: now,
        nextReviewAt: initialNext.nextReviewAt,
      })
      .onConflictDoUpdate({
        target: [wordProgress.userId, wordProgress.wordId],
        set: {
          status: statusExpression,
          mastery: masteryExpression,
          intervalDays: intervalExpression,
          correctCount: sql`${wordProgress.correctCount} + ${rating === "again" ? 0 : 1}`,
          incorrectCount: sql`${wordProgress.incorrectCount} + ${rating === "again" ? 1 : 0}`,
          lastReviewedAt: now,
          nextReviewAt: nextReviewExpression,
          updatedAt: now,
        },
      })
      .returning({
        intervalDays: wordProgress.intervalDays,
        nextReviewAt: wordProgress.nextReviewAt,
        mastery: wordProgress.mastery,
        status: wordProgress.status,
      });

    return NextResponse.json({ ...saved, persisted: true });
  } catch (error) {
    markDatabaseFailure(error);
    return NextResponse.json(
      {
        message: "Không thể lưu tiến độ lúc này.",
        persisted: false,
        reason: "database_unavailable",
      },
      { status: 503 },
    );
  }
}
