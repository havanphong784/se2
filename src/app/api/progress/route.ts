import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { users, wordProgress } from "@/db/schema";
import { computeNextReview, type Rating } from "@/lib/study";

export const runtime = "nodejs";

type ProgressPayload = {
  wordId?: unknown;
  rating?: unknown;
  intervalDays?: unknown;
};

const ratings: Rating[] = ["again", "hard", "good"];

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ProgressPayload | null;
  if (
    !body ||
    typeof body.wordId !== "string" ||
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
  const fallbackInterval =
    typeof body.intervalDays === "number" ? Math.max(0, body.intervalDays) : 0;

  if (!db) {
    const next = computeNextReview({ intervalDays: fallbackInterval }, rating, now);
    return NextResponse.json({ ...next, persisted: false });
  }

  const email = process.env.DEMO_USER_EMAIL ?? "demo@vocabloom.vn";
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return NextResponse.json(
      { message: "Hãy chạy pnpm db:seed trước khi lưu tiến độ." },
      { status: 503 },
    );
  }

  const [current] = await db
    .select()
    .from(wordProgress)
    .where(
      and(
        eq(wordProgress.userId, user.id),
        eq(wordProgress.wordId, body.wordId),
      ),
    )
    .limit(1);

  const next = computeNextReview(
    { intervalDays: current?.intervalDays ?? fallbackInterval },
    rating,
    now,
  );
  const mastery = Math.max(
    0,
    Math.min(
      100,
      (current?.mastery ?? 0) + (rating === "again" ? -15 : rating === "hard" ? 6 : 16),
    ),
  );
  const status = mastery >= 80 ? "mastered" : mastery > 0 ? "learning" : "new";

  await db
    .insert(wordProgress)
    .values({
      userId: user.id,
      wordId: body.wordId,
      status,
      mastery,
      intervalDays: next.intervalDays,
      correctCount: rating === "again" ? 0 : 1,
      incorrectCount: rating === "again" ? 1 : 0,
      lastReviewedAt: now,
      nextReviewAt: next.nextReviewAt,
    })
    .onConflictDoUpdate({
      target: [wordProgress.userId, wordProgress.wordId],
      set: {
        status,
        mastery,
        intervalDays: next.intervalDays,
        correctCount:
          (current?.correctCount ?? 0) + (rating === "again" ? 0 : 1),
        incorrectCount:
          (current?.incorrectCount ?? 0) + (rating === "again" ? 1 : 0),
        lastReviewedAt: now,
        nextReviewAt: next.nextReviewAt,
        updatedAt: now,
      },
    });

  return NextResponse.json({ ...next, mastery, status, persisted: true });
}
