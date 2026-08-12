import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { dailyActivity, decks, studySessions, words } from "@/db/schema";
import { getDemoUser, isUuid } from "@/lib/server-data";

export const runtime = "nodejs";

type SessionPayload = {
  sessionId?: unknown;
  deckId?: unknown;
  reviewedCount?: unknown;
  learnedCount?: unknown;
  correctCount?: unknown;
  durationSeconds?: unknown;
};

function safeCount(value: unknown) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
    ? value
    : null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SessionPayload | null;
  const sessionId = body?.sessionId;
  const deckId = body?.deckId;
  const reviewedCount = safeCount(body?.reviewedCount);
  const learnedCount = safeCount(body?.learnedCount);
  const correctCount = safeCount(body?.correctCount);
  const durationSeconds = safeCount(body?.durationSeconds);

  if (
    !body ||
    typeof sessionId !== "string" ||
    !isUuid(sessionId) ||
    typeof deckId !== "string" ||
    !isUuid(deckId) ||
    reviewedCount === null ||
    learnedCount === null ||
    correctCount === null ||
    durationSeconds === null ||
    durationSeconds > 24 * 60 * 60 ||
    correctCount > reviewedCount ||
    learnedCount > reviewedCount
  ) {
    return NextResponse.json(
      { message: "Dữ liệu phiên học không hợp lệ." },
      { status: 400 },
    );
  }

  const xpEarned = correctCount * 8 + (reviewedCount - correctCount) * 2;
  const db = getDb();
  if (!db) {
    return NextResponse.json({ persisted: false, xpEarned });
  }

  try {
    const [user, deck] = await Promise.all([
      getDemoUser(db),
      db
        .select({ id: decks.id, wordCount: sql<number>`count(${words.id})::int` })
        .from(decks)
        .leftJoin(words, eq(words.deckId, decks.id))
        .where(eq(decks.id, deckId))
        .groupBy(decks.id)
        .limit(1),
    ]);

    if (!user) {
      return NextResponse.json(
        { message: "Hãy chạy pnpm db:seed trước khi lưu phiên học." },
        { status: 503 },
      );
    }
    if (!deck.length) {
      return NextResponse.json({ message: "Không tìm thấy bộ từ." }, { status: 404 });
    }
    if (reviewedCount > deck[0].wordCount) {
      return NextResponse.json(
        { message: "Số từ đã ôn vượt quá số từ trong bộ." },
        { status: 400 },
      );
    }

    const completedAt = new Date();
    const startedAt = new Date(completedAt.getTime() - durationSeconds * 1_000);
    const dateKey = completedAt.toISOString().slice(0, 10);

    const inserted = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(studySessions)
        .values({
          id: sessionId,
          userId: user.id,
          deckId,
          reviewedCount,
          correctCount,
          durationSeconds,
          xpEarned,
          startedAt,
          completedAt,
        })
        .onConflictDoNothing({ target: studySessions.id })
        .returning({ id: studySessions.id });

      if (!rows.length) return false;

      await tx
        .insert(dailyActivity)
        .values({
          userId: user.id,
          activityDate: dateKey,
          reviewedCount,
          learnedCount,
          correctCount,
          xpEarned,
          studySeconds: durationSeconds,
        })
        .onConflictDoUpdate({
          target: [dailyActivity.userId, dailyActivity.activityDate],
          set: {
            reviewedCount: sql`${dailyActivity.reviewedCount} + ${reviewedCount}`,
            learnedCount: sql`${dailyActivity.learnedCount} + ${learnedCount}`,
            correctCount: sql`${dailyActivity.correctCount} + ${correctCount}`,
            xpEarned: sql`${dailyActivity.xpEarned} + ${xpEarned}`,
            studySeconds: sql`${dailyActivity.studySeconds} + ${durationSeconds}`,
            updatedAt: completedAt,
          },
        });

      return true;
    });

    return NextResponse.json({ persisted: true, xpEarned, duplicate: !inserted });
  } catch (error) {
    console.error("Unable to save study session.", error);
    return NextResponse.json({ message: "Không thể lưu phiên học lúc này." }, { status: 503 });
  }
}
