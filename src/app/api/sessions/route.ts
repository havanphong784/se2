import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { dailyActivity, studySessions, users } from "@/db/schema";

export const runtime = "nodejs";

type SessionPayload = {
  deckId?: unknown;
  reviewedCount?: unknown;
  learnedCount?: unknown;
  correctCount?: unknown;
  durationSeconds?: unknown;
  xpEarned?: unknown;
};

function safeCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SessionPayload | null;
  const reviewedCount = safeCount(body?.reviewedCount);
  const learnedCount = safeCount(body?.learnedCount);
  const correctCount = safeCount(body?.correctCount);
  const durationSeconds = safeCount(body?.durationSeconds);
  const xpEarned = safeCount(body?.xpEarned);

  if (
    !body ||
    typeof body.deckId !== "string" ||
    reviewedCount === null ||
    learnedCount === null ||
    correctCount === null ||
    durationSeconds === null ||
    xpEarned === null ||
    correctCount > reviewedCount ||
    learnedCount > reviewedCount
  ) {
    return NextResponse.json(
      { message: "Dữ liệu phiên học không hợp lệ." },
      { status: 400 },
    );
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ persisted: false, xpEarned });
  }

  const email = process.env.DEMO_USER_EMAIL ?? "demo@vocabloom.vn";
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) {
    return NextResponse.json(
      { message: "Hãy chạy pnpm db:seed trước khi lưu phiên học." },
      { status: 503 },
    );
  }

  const completedAt = new Date();
  const startedAt = new Date(completedAt.getTime() - durationSeconds * 1_000);
  await db.insert(studySessions).values({
    userId: user.id,
    deckId: body.deckId,
    reviewedCount,
    correctCount,
    durationSeconds,
    xpEarned,
    startedAt,
    completedAt,
  });

  const dateKey = completedAt.toISOString().slice(0, 10);
  await db
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

  return NextResponse.json({ persisted: true, xpEarned });
}
