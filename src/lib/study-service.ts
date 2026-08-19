import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";

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
import { vnDateKeyOffset } from "@/lib/utils";
import {
  evaluateStudyAnswer,
  normalizeAnswer,
  scheduleCorrectReview,
  scheduleIncorrectReview,
  scheduleLearnedWord,
  type ReviewStage,
  type SessionSize,
  type StudyMode,
  type StudyPhase,
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

export type StudyEventResult = {
  eventId: string;
  wordId: string;
  phase: StudyPhase;
  isCorrect: boolean;
  expectedAnswer: string;
};

export type SubmitStudyEventResult = {
  session: StudySessionDto;
  result: StudyEventResult;
};

export type StudySessionDto = {
  id: string;
  mode: StudyMode;
  status: "active" | "completed" | "abandoned";
  phase: StudyPhase | null;
  requestedSize: SessionSize;
  selectedSize: number;
  learnedCount: number;
  reviewedCount: number;
  attemptCount: number;
  incorrectCount: number;
  words: Array<{
    id: string;
    position: number;
    term: string;
    translation: string;
    phonetic: string;
    partOfSpeech: string[];
    exampleSentence: string;
    exampleTranslation: string;
    flashcardCompleted: boolean;
    multipleChoiceCompleted: boolean;
    typingCompleted: boolean;
    hadIncorrectAttempt: boolean;
  }>;
};

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

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
      sessionWordId: studySessionWords.id,
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
      hadIncorrectAttempt: studySessionWords.hadIncorrectAttempt,
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
      hadIncorrectAttempt: item.hadIncorrectAttempt === 1,
    })),
  } satisfies StudySessionDto;
}

export async function createStudySession(
  db: Db,
  input: { mode: StudyMode; deckId?: string; requestedSize: SessionSize },
  userId: string,
) {
  return db.transaction(async (tx) => {
    const now = new Date();

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
                eq(words.deckId, input.deckId!),
                or(isNull(wordProgress.id), isNull(wordProgress.learnedAt)),
              ),
            )
            .orderBy(asc(words.sortOrder), asc(words.id))
            .limit(input.requestedSize)
        : await tx
            .select({ id: words.id })
            .from(wordProgress)
            .innerJoin(words, eq(words.id, wordProgress.wordId))
            .where(
              and(
                eq(wordProgress.userId, userId),
                sql`${wordProgress.learnedAt} is not null`,
                isNull(wordProgress.reviewCompletedAt),
                sql`${wordProgress.nextReviewAt} < ${vnDateKeyOffset(1, now)}`,
              ),
            )
            .orderBy(
              asc(wordProgress.nextReviewAt),
              sql`${wordProgress.lastReviewedAt} asc nulls first`,
              asc(words.id),
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
        deckId: input.mode === "learn" ? input.deckId : null,
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
  values: { learned: number; reviewed: number; correct: number; xp: number },
) {
  await tx
    .insert(dailyActivity)
    .values({
      userId,
      activityDate: dateKey(now),
      learnedCount: values.learned,
      reviewedCount: values.reviewed,
      correctCount: values.correct,
      xpEarned: values.xp,
    })
    .onConflictDoUpdate({
      target: [dailyActivity.userId, dailyActivity.activityDate],
      set: {
        learnedCount: sql`${dailyActivity.learnedCount} + ${values.learned}`,
        reviewedCount: sql`${dailyActivity.reviewedCount} + ${values.reviewed}`,
        correctCount: sql`${dailyActivity.correctCount} + ${values.correct}`,
        xpEarned: sql`${dailyActivity.xpEarned} + ${values.xp}`,
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
    selectedWordId?: string;
    answer?: string;
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
        term: words.term,
        translation: words.translation,
      })
      .from(studyAttempts)
      .innerJoin(studySessionWords, eq(studySessionWords.id, studyAttempts.sessionWordId))
      .innerJoin(studySessions, eq(studySessions.id, studySessionWords.sessionId))
      .innerJoin(words, eq(words.id, studySessionWords.wordId))
      .where(eq(studyAttempts.id, input.eventId))
      .limit(1);
    if (duplicate) {
      const payloadMatches =
        duplicate.sessionId === input.sessionId &&
        duplicate.userId === userId &&
        duplicate.wordId === input.wordId &&
        duplicate.phase === input.phase &&
        (input.phase !== "multiple_choice" ||
          duplicate.selectedWordId === input.selectedWordId) &&
        (input.phase !== "typing" ||
          duplicate.answerNormalized === normalizeAnswer(input.answer ?? ""));
      if (!payloadMatches) {
        throw new StudyServiceError(
          "Mã lượt học đã được dùng cho một câu trả lời khác.",
          409,
        );
      }
      return {
        session: await getStudySession(tx, input.sessionId, userId),
        result: {
          eventId: input.eventId,
          wordId: input.wordId,
          phase: input.phase,
          isCorrect: duplicate.isCorrect === 1,
          expectedAnswer:
            input.phase === "typing" ? duplicate.term : duplicate.translation,
        },
      } satisfies SubmitStudyEventResult;
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
    if (!session || session.status !== "active") {
      throw new StudyServiceError("Phiên học không còn hoạt động.", 409);
    }
    if (session.phase !== input.phase) {
      throw new StudyServiceError("Bước học không khớp với phiên hiện tại.", 409);
    }

    const [sessionWord] = await tx
      .select({
        id: studySessionWords.id,
        term: words.term,
        translation: words.translation,
        hadIncorrectAttempt: studySessionWords.hadIncorrectAttempt,
        flashcardCompletedAt: studySessionWords.flashcardCompletedAt,
        multipleChoiceCompletedAt: studySessionWords.multipleChoiceCompletedAt,
        typingCompletedAt: studySessionWords.typingCompletedAt,
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

    if (input.phase === "multiple_choice" && !sessionWord.flashcardCompletedAt) {
      throw new StudyServiceError("Từ chưa hoàn thành flashcard.", 409);
    }
    if (input.phase === "typing" && session.mode === "learn" && !sessionWord.multipleChoiceCompletedAt) {
      throw new StudyServiceError("Từ chưa hoàn thành trắc nghiệm.", 409);
    }
    if (
      (input.phase === "flashcard" && sessionWord.flashcardCompletedAt) ||
      (input.phase === "multiple_choice" && sessionWord.multipleChoiceCompletedAt) ||
      (input.phase === "typing" && sessionWord.typingCompletedAt)
    ) {
      throw new StudyServiceError("Từ đã hoàn thành bước học này.", 409);
    }
    if (input.phase === "multiple_choice") {
      const [selectedWord] = await tx
        .select({ id: studySessionWords.id })
        .from(studySessionWords)
        .where(
          and(
            eq(studySessionWords.sessionId, input.sessionId),
            eq(studySessionWords.wordId, input.selectedWordId!),
          ),
        )
        .limit(1);
      if (!selectedWord) {
        throw new StudyServiceError("Đáp án không thuộc phiên học.", 400);
      }
    }

    const now = new Date();
    const grading = evaluateStudyAnswer({
      phase: input.phase,
      wordId: input.wordId,
      term: sessionWord.term,
      translation: sessionWord.translation,
      selectedWordId: input.selectedWordId,
      answer: input.answer,
    });
    const correct = grading.isCorrect;

    await tx.insert(studyAttempts).values({
      id: input.eventId,
      sessionWordId: sessionWord.id,
      phase: input.phase,
      answerNormalized:
        input.phase === "typing" ? normalizeAnswer(input.answer ?? "") : null,
      selectedWordId: input.phase === "multiple_choice" ? input.selectedWordId : null,
      isCorrect: correct ? 1 : 0,
      attemptedAt: now,
    });

    if (input.phase === "flashcard") {
      await tx
        .update(studySessionWords)
        .set({ flashcardCompletedAt: now, updatedAt: now })
        .where(eq(studySessionWords.id, sessionWord.id));
    } else {
      await tx
        .update(studySessionWords)
        .set({
          correctAttemptCount: correct
            ? sql`${studySessionWords.correctAttemptCount} + 1`
            : studySessionWords.correctAttemptCount,
          incorrectAttemptCount: correct
            ? studySessionWords.incorrectAttemptCount
            : sql`${studySessionWords.incorrectAttemptCount} + 1`,
          hadIncorrectAttempt: correct ? studySessionWords.hadIncorrectAttempt : 1,
          lastIncorrectAt: correct ? undefined : now,
          multipleChoiceCompletedAt:
            input.phase === "multiple_choice" && correct ? now : undefined,
          typingCompletedAt: input.phase === "typing" && correct ? now : undefined,
          completedAt: input.phase === "typing" && correct ? now : undefined,
          updatedAt: now,
        })
        .where(eq(studySessionWords.id, sessionWord.id));

      await tx
        .update(studySessions)
        .set({
          attemptCount: sql`${studySessions.attemptCount} + 1`,
          correctCount: correct
            ? sql`${studySessions.correctCount} + 1`
            : studySessions.correctCount,
          incorrectCount: correct
            ? studySessions.incorrectCount
            : sql`${studySessions.incorrectCount} + 1`,
          lastActivityAt: now,
          updatedAt: now,
        })
        .where(eq(studySessions.id, session.id));
    }

    if (input.phase === "typing") {
      const [progress] = await tx
        .select()
        .from(wordProgress)
        .where(and(eq(wordProgress.userId, userId), eq(wordProgress.wordId, input.wordId)))
        .limit(1);

      if (!correct && session.mode === "review" && progress) {
        const schedule = scheduleIncorrectReview(now);
        await tx
          .update(wordProgress)
          .set({
            status: schedule.status,
            reviewStage: schedule.reviewStage,
            intervalDays: schedule.intervalDays,
            nextReviewAt: schedule.nextReviewAt,
            reviewCompletedAt: null,
            incorrectCount: sql`${wordProgress.incorrectCount} + 1`,
            lastReviewedAt: now,
            updatedAt: now,
          })
          .where(eq(wordProgress.id, progress.id));
      }

      if (correct) {
        if (session.mode === "learn") {
          const schedule = scheduleLearnedWord(now);
          await tx
            .insert(wordProgress)
            .values({
              userId: userId,
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
              reviewedCount: sql`${studySessions.reviewedCount} + 1`,
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
          const schedule = scheduleCorrectReview(
            progress.reviewStage as ReviewStage,
            sessionWord.hadIncorrectAttempt === 1,
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
              reviewedCount: sql`${studySessions.reviewedCount} + 1`,
              xpEarned: sql`${studySessions.xpEarned} + 10`,
            })
            .where(eq(studySessions.id, session.id));
          await updateDailyActivity(tx, userId, now, {
            learned: 0,
            reviewed: 1,
            correct: 1,
            xp: 10,
          });
        }
      }
    }

    const completionColumn =
      input.phase === "flashcard"
        ? studySessionWords.flashcardCompletedAt
        : input.phase === "multiple_choice"
          ? studySessionWords.multipleChoiceCompletedAt
          : studySessionWords.typingCompletedAt;
    const [{ remaining }] = await tx
      .select({ remaining: sql<number>`count(*) filter (where ${completionColumn} is null)::int` })
      .from(studySessionWords)
      .where(eq(studySessionWords.sessionId, session.id));

    if (remaining === 0) {
      const nextPhase =
        session.mode === "learn" && input.phase === "flashcard"
          ? "multiple_choice"
          : session.mode === "learn" && input.phase === "multiple_choice"
            ? "typing"
            : null;
      await tx
        .update(studySessions)
        .set({
          phase: nextPhase,
          status: nextPhase ? "active" : "completed",
          completedAt: nextPhase ? null : now,
          durationSeconds: nextPhase
            ? studySessions.durationSeconds
            : sql`greatest(1, extract(epoch from (${now.toISOString()}::timestamptz - ${studySessions.startedAt}))::integer)`,
          lastActivityAt: now,
          updatedAt: now,
        })
        .where(eq(studySessions.id, session.id));
    }

    return {
      session: await getStudySession(tx, session.id, userId),
      result: {
        eventId: input.eventId,
        wordId: input.wordId,
        phase: input.phase,
        isCorrect: grading.isCorrect,
        expectedAnswer: grading.expectedAnswer,
      },
    } satisfies SubmitStudyEventResult;
  });
}

export async function abandonStudySession(db: Db, sessionId: string, userId: string) {
  const now = new Date();
  await db
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
  return getStudySession(db, sessionId, userId);
}
