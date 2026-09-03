import { and, asc, eq, isNull, lt, or, sql } from "drizzle-orm";

import type { getDb } from "@/db";
import {
  dailyActivity,
  decks,
  studyAttempts,
  studySessions,
  studySessionWords,
  wordProgress,
  words,
} from "@/db/schema";
import { vnDateBoundary, vnDateKey } from "@/lib/utils";
import {
  evaluateStudyAnswer,
  getPersistedAttemptCounts,
  normalizeAnswer,
  scheduleCorrectReview,
  scheduleLearnedWord,
  type ReviewStage,
  type SessionSize,
  type StudyMode,
  type StudyPhase,
  type StudySessionDto,
} from "@/lib/study";

export class StudyServiceError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

type Db = NonNullable<ReturnType<typeof getDb>>;
type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type { StudySessionDto } from "@/lib/study";

export async function getStudySession(
  db: Db | Transaction,
  sessionId: string,
  userId: string,
) {
  const [session] = await db
    .select()
    .from(studySessions)
    .where(
      and(
        eq(studySessions.id, sessionId),
        eq(studySessions.userId, userId),
      ),
    )
    .limit(1);
  if (!session || session.mode === "legacy") {
    throw new StudyServiceError("Không tìm thấy phiên học.", 404);
  }

  const sessionWordRows = await db
    .select({
      wordId: words.id,
      position: studySessionWords.position,
      term: words.term,
      translation: words.translation,
      phonetic: words.phonetic,
      partOfSpeech: words.partOfSpeech,
      exampleSentence: words.exampleSentence,
      exampleTranslation: words.exampleTranslation,
      flashcardCompletedAt: studySessionWords.flashcardCompletedAt,
      multipleChoiceCompletedAt: studySessionWords.multipleChoiceCompletedAt,
      typingCompletedAt: studySessionWords.typingCompletedAt,
      incorrectAttemptCount: studySessionWords.incorrectAttemptCount,
    })
    .from(studySessionWords)
    .innerJoin(words, eq(words.id, studySessionWords.wordId))
    .where(eq(studySessionWords.sessionId, sessionId))
    .orderBy(asc(studySessionWords.position));

  return {
    id: session.id,
    mode: session.mode as StudyMode,
    status: session.status as StudySessionDto["status"],
    phase: session.phase as StudyPhase | null,
    requestedSize: session.requestedSize as SessionSize,
    selectedSize: session.selectedSize,
    learnedCount: session.learnedCount,
    reviewedCount: session.reviewedCount,
    attemptCount: session.attemptCount,
    incorrectCount: session.incorrectCount,
    words: sessionWordRows.map((item) => ({
      id: item.wordId,
      position: item.position,
      term: item.term,
      translation: item.translation,
      phonetic: item.phonetic,
      partOfSpeech: item.partOfSpeech,
      exampleSentence: item.exampleSentence,
      exampleTranslation: item.exampleTranslation,
      flashcardCompleted: Boolean(item.flashcardCompletedAt),
      multipleChoiceCompleted: Boolean(item.multipleChoiceCompletedAt),
      typingCompleted: Boolean(item.typingCompletedAt),
      incorrectAttemptCount: item.incorrectAttemptCount,
    })),
  } satisfies StudySessionDto;
}

export async function createStudySession(
  db: Db,
  input: { mode: StudyMode; deckId?: string; deckSlug?: string; requestedSize: SessionSize },
  userId: string,
) {
  return db.transaction(async (tx) => {
    const now = new Date();

    const visibleDeck = or(isNull(decks.ownerId), eq(decks.ownerId, userId));
    const [deck] = input.deckId
      ? await tx
          .select({ id: decks.id })
          .from(decks)
          .where(and(eq(decks.id, input.deckId), visibleDeck))
          .limit(1)
      : input.deckSlug
        ? await tx
            .select({ id: decks.id })
            .from(decks)
            .where(and(eq(decks.slug, input.deckSlug), visibleDeck))
            .orderBy(sql`${decks.ownerId} is null`)
            .limit(1)
        : [];
    if (input.mode === "learn" && !deck) {
      throw new StudyServiceError("Không tìm thấy bộ từ.", 404);
    }
    const candidates =
      input.mode === "learn"
        ? await tx
            .select({ id: words.id })
            .from(words)
            .innerJoin(decks, eq(decks.id, words.deckId))
            .leftJoin(
              wordProgress,
              and(eq(wordProgress.wordId, words.id), eq(wordProgress.userId, userId)),
            )
            .where(
              and(
                eq(words.deckId, deck!.id),
                or(isNull(wordProgress.id), isNull(wordProgress.learnedAt)),
              ),
            )
            .orderBy(asc(words.sortOrder), asc(words.id))
            .limit(input.requestedSize)
        : await tx
            .select({ id: wordProgress.wordId })
            .from(wordProgress)
            .where(
              and(
                eq(wordProgress.userId, userId),
                sql`${wordProgress.learnedAt} is not null`,
                isNull(wordProgress.reviewCompletedAt),
                lt(wordProgress.nextReviewAt, vnDateBoundary(1, now)),
              ),
            )
            .orderBy(
              asc(wordProgress.nextReviewAt),
              sql`${wordProgress.lastReviewedAt} asc nulls first`,
              asc(wordProgress.wordId),
            )
            .limit(input.requestedSize);

    if (!candidates.length) {
      throw new StudyServiceError(
        input.mode === "learn" ? "Bộ từ không còn từ mới." : "Chưa có từ đến hạn ôn.",
        409,
      );
    }

    const [session] = await tx
      .insert(studySessions)
      .values({
        userId: userId,
        deckId: input.mode === "learn" ? deck?.id : null,
        mode: input.mode,
        status: "active",
        phase: input.mode === "learn" ? "flashcard" : "typing",
        requestedSize: input.requestedSize,
        selectedSize: candidates.length,
        startedAt: now,
        lastActivityAt: now,
      })
      .returning({ id: studySessions.id });

    await tx.insert(studySessionWords).values(
      candidates.map((candidate, position) => ({
        sessionId: session.id,
        wordId: candidate.id,
        position,
      })),
    );

    return getStudySession(tx, session.id, userId);
  });
}

async function updateDailyActivity(
  tx: Transaction,
  userId: string,
  now: Date,
  values: {
    learned: number;
    reviewed: number;
    correct: number;
    xp: number;
    studySeconds?: number;
  },
) {
  const studySeconds = values.studySeconds ?? 0;
  await tx
    .insert(dailyActivity)
    .values({
      userId,
      activityDate: vnDateKey(now),
      learnedCount: values.learned,
      reviewedCount: values.reviewed,
      correctCount: values.correct,
      xpEarned: values.xp,
      studySeconds,
    })
    .onConflictDoUpdate({
      target: [dailyActivity.userId, dailyActivity.activityDate],
      set: {
        learnedCount: sql`${dailyActivity.learnedCount} + ${values.learned}`,
        reviewedCount: sql`${dailyActivity.reviewedCount} + ${values.reviewed}`,
        correctCount: sql`${dailyActivity.correctCount} + ${values.correct}`,
        xpEarned: sql`${dailyActivity.xpEarned} + ${values.xp}`,
        studySeconds: sql`${dailyActivity.studySeconds} + ${studySeconds}`,
        updatedAt: now,
      },
    });
}

export async function submitStudyEvent(
  db: Db,
  input: {
    sessionId: string;
    eventId: string;
    wordId: string;
    phase: StudyPhase;
    answer: string;
    selectedWordId?: string;
    isCorrect: boolean;
  },
  userId: string,
) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${input.sessionId}, 0))`,
    );
    const [duplicate] = await tx
      .select({
        sessionId: studySessionWords.sessionId,
        userId: studySessions.userId,
        wordId: studySessionWords.wordId,
        phase: studyAttempts.phase,
        answerNormalized: studyAttempts.answerNormalized,
        selectedWordId: studyAttempts.selectedWordId,
        isCorrect: studyAttempts.isCorrect,
      })
      .from(studyAttempts)
      .innerJoin(studySessionWords, eq(studySessionWords.id, studyAttempts.sessionWordId))
      .innerJoin(studySessions, eq(studySessions.id, studySessionWords.sessionId))
      .where(eq(studyAttempts.id, input.eventId))
      .limit(1);
    if (duplicate) {
      const payloadMatches =
        duplicate.sessionId === input.sessionId &&
        duplicate.userId === userId &&
        duplicate.wordId === input.wordId &&
        duplicate.phase === input.phase &&
        duplicate.answerNormalized === normalizeAnswer(input.answer) &&
        duplicate.selectedWordId === (input.selectedWordId ?? null) &&
        duplicate.isCorrect === Number(input.isCorrect);
      if (!payloadMatches) {
        throw new StudyServiceError(
          "Mã lượt học đã được dùng cho một câu trả lời khác.",
          409,
        );
      }
      return;
    }

    const [session] = await tx
      .select()
      .from(studySessions)
      .where(
        and(
          eq(studySessions.id, input.sessionId),
          eq(studySessions.userId, userId),
        ),
      )
      .limit(1);
    if (!session || session.status === "abandoned") {
      throw new StudyServiceError("Phiên học không còn hoạt động.", 409);
    }
    if (session.status === "completed") return;
    if (session.phase !== input.phase) {
      throw new StudyServiceError("Bước học không còn hoạt động.", 409);
    }

    const [sessionWord] = await tx
      .select({
        id: studySessionWords.id,
        term: words.term,
        translation: words.translation,
        flashcardCompletedAt: studySessionWords.flashcardCompletedAt,
        multipleChoiceCompletedAt: studySessionWords.multipleChoiceCompletedAt,
        typingCompletedAt: studySessionWords.typingCompletedAt,
        hadIncorrectAttempt: studySessionWords.hadIncorrectAttempt,
      })
      .from(studySessionWords)
      .innerJoin(words, eq(words.id, studySessionWords.wordId))
      .where(
        and(
          eq(studySessionWords.sessionId, input.sessionId),
          eq(studySessionWords.wordId, input.wordId),
        ),
      )
      .limit(1);
    if (!sessionWord) throw new StudyServiceError("Từ không thuộc phiên học.", 404);

    const completion =
      input.phase === "flashcard"
        ? sessionWord.flashcardCompletedAt
        : input.phase === "multiple_choice"
          ? sessionWord.multipleChoiceCompletedAt
          : sessionWord.typingCompletedAt;
    if (completion) throw new StudyServiceError("Từ đã hoàn thành bước học này.", 409);

    const grading = evaluateStudyAnswer({
      phase: input.phase,
      wordId: input.wordId,
      term: sessionWord.term,
      translation: sessionWord.translation,
      selectedWordId: input.selectedWordId,
      answer: input.answer,
    });
    const correct = grading.isCorrect;
    if (correct !== input.isCorrect || (!correct && input.phase === "flashcard")) {
      throw new StudyServiceError("Kết quả lượt học không hợp lệ.", 409);
    }

    const now = new Date();
    const counts = getPersistedAttemptCounts(input.phase, correct);
    await tx.insert(studyAttempts).values({
      id: input.eventId,
      sessionWordId: sessionWord.id,
      phase: input.phase,
      answerNormalized: normalizeAnswer(input.answer),
      selectedWordId: input.selectedWordId,
      isCorrect: correct ? 1 : 0,
      attemptedAt: now,
    });

    const completionValues = correct
      ? input.phase === "flashcard"
        ? { flashcardCompletedAt: now }
        : input.phase === "multiple_choice"
          ? { multipleChoiceCompletedAt: now }
          : { typingCompletedAt: now, completedAt: now }
      : {};
    await tx
      .update(studySessionWords)
      .set({
        ...completionValues,
        correctAttemptCount: sql`${studySessionWords.correctAttemptCount} + ${counts.correct}`,
        incorrectAttemptCount: correct
          ? studySessionWords.incorrectAttemptCount
          : sql`${studySessionWords.incorrectAttemptCount} + 1`,
        hadIncorrectAttempt: correct ? studySessionWords.hadIncorrectAttempt : 1,
        lastIncorrectAt: correct ? undefined : now,
        updatedAt: now,
      })
      .where(eq(studySessionWords.id, sessionWord.id));
    await tx
      .update(studySessions)
      .set({
        attemptCount: sql`${studySessions.attemptCount} + ${counts.attempts}`,
        correctCount: sql`${studySessions.correctCount} + ${counts.correct}`,
        incorrectCount: sql`${studySessions.incorrectCount} + ${Number(!correct)}`,
        lastActivityAt: now,
        updatedAt: now,
      })
      .where(eq(studySessions.id, session.id));

    if (correct && input.phase !== "typing") {
      const completionColumn =
        input.phase === "flashcard"
          ? studySessionWords.flashcardCompletedAt
          : studySessionWords.multipleChoiceCompletedAt;
      const [{ remaining }] = await tx
        .select({
          remaining: sql<number>`count(*) filter (where ${completionColumn} is null)::int`,
        })
        .from(studySessionWords)
        .where(eq(studySessionWords.sessionId, session.id));
      if (remaining === 0) {
        await tx
          .update(studySessions)
          .set({
            phase: input.phase === "flashcard" ? "multiple_choice" : "typing",
            updatedAt: now,
          })
          .where(eq(studySessions.id, session.id));
      }
    }
    if (input.phase !== "typing") return;

    const [progress] = await tx
      .select()
      .from(wordProgress)
      .where(and(eq(wordProgress.userId, userId), eq(wordProgress.wordId, input.wordId)))
      .limit(1);

    if (!correct) {
      if (session.mode === "review" && progress) {
        const schedule = scheduleCorrectReview(
          progress.reviewStage as ReviewStage,
          true,
          now,
        );
        await tx
          .update(wordProgress)
          .set({
            status: schedule.status,
            mastery: 25,
            reviewStage: schedule.reviewStage,
            intervalDays: schedule.intervalDays,
            incorrectCount: sql`${wordProgress.incorrectCount} + 1`,
            lastReviewedAt: now,
            nextReviewAt: schedule.nextReviewAt,
            reviewCompletedAt: null,
            updatedAt: now,
          })
          .where(eq(wordProgress.id, progress.id));
      }
      return;
    }

    if (session.mode === "learn") {
      const schedule = scheduleLearnedWord(now);
      await tx
        .insert(wordProgress)
        .values({
          userId,
          wordId: input.wordId,
          status: schedule.status,
          mastery: 25,
          learnedAt: now,
          reviewStage: schedule.reviewStage,
          intervalDays: schedule.intervalDays,
          correctCount: 1,
          lastReviewedAt: now,
          nextReviewAt: schedule.nextReviewAt,
        })
        .onConflictDoUpdate({
          target: [wordProgress.userId, wordProgress.wordId],
          set: {
            status: schedule.status,
            mastery: 25,
            learnedAt: now,
            reviewStage: schedule.reviewStage,
            intervalDays: schedule.intervalDays,
            correctCount: sql`${wordProgress.correctCount} + 1`,
            lastReviewedAt: now,
            nextReviewAt: schedule.nextReviewAt,
            reviewCompletedAt: null,
            updatedAt: now,
          },
        });
      await tx
        .update(studySessions)
        .set({
          learnedCount: sql`${studySessions.learnedCount} + 1`,
          xpEarned: sql`${studySessions.xpEarned} + 15`,
        })
        .where(eq(studySessions.id, session.id));
      await updateDailyActivity(tx, userId, now, {
        learned: 1,
        reviewed: 0,
        correct: 1,
        xp: 15,
      });
    } else if (progress) {
      const firstAttempt = !sessionWord.hadIncorrectAttempt;
      const schedule = scheduleCorrectReview(
        progress.reviewStage as ReviewStage,
        !firstAttempt,
        now,
      );
      await tx
        .update(wordProgress)
        .set({
          status: schedule.status,
          mastery: schedule.reviewStage === 3 ? 100 : 25 + schedule.reviewStage * 25,
          reviewStage: schedule.reviewStage,
          intervalDays: schedule.intervalDays,
          correctCount: sql`${wordProgress.correctCount} + 1`,
          lastReviewedAt: now,
          nextReviewAt: schedule.nextReviewAt,
          reviewCompletedAt: schedule.reviewCompletedAt,
          updatedAt: now,
        })
        .where(eq(wordProgress.id, progress.id));
      await tx
        .update(studySessions)
        .set({
          reviewedCount: sql`${studySessions.reviewedCount} + ${Number(firstAttempt)}`,
          xpEarned: sql`${studySessions.xpEarned} + 10`,
        })
        .where(eq(studySessions.id, session.id));
      await updateDailyActivity(tx, userId, now, {
        learned: 0,
        reviewed: Number(firstAttempt),
        correct: 1,
        xp: 10,
      });
    }

    const [{ remaining }] = await tx
      .select({
        remaining: sql<number>`count(*) filter (where ${studySessionWords.typingCompletedAt} is null)::int`,
      })
      .from(studySessionWords)
      .where(eq(studySessionWords.sessionId, session.id));
    if (remaining === 0) {
      const durationSeconds = Math.max(
        1,
        Math.round((now.getTime() - session.startedAt.getTime()) / 1_000),
      );
      await tx
        .update(studySessions)
        .set({
          phase: null,
          status: "completed",
          completedAt: now,
          durationSeconds,
          lastActivityAt: now,
          updatedAt: now,
        })
        .where(eq(studySessions.id, session.id));
      await updateDailyActivity(tx, userId, now, {
        learned: 0,
        reviewed: 0,
        correct: 0,
        xp: 0,
        studySeconds: durationSeconds,
      });
    }
  });
}

export async function abandonStudySession(db: Db, sessionId: string, userId: string) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${sessionId}, 0))`,
    );
    const now = new Date();
    await tx
      .update(studySessions)
      .set({
        status: "abandoned",
        abandonedAt: now,
        durationSeconds: sql`greatest(1, extract(epoch from (${now.toISOString()}::timestamptz - ${studySessions.startedAt}))::integer)`,
        lastActivityAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(studySessions.id, sessionId),
          eq(studySessions.userId, userId),
          eq(studySessions.status, "active"),
        ),
      );
    return getStudySession(tx, sessionId, userId);
  });
}
