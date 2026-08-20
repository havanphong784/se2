import assert from "node:assert/strict";
import test from "node:test";

import {
  addDays,
  applyStudyResult,
  compareReviewPriority,
  createMultipleChoiceOptions,
  evaluateStudyAnswer,
  getPersistedAttemptCounts,
  getStudyShortcutAction,
  getStudySpeechSpeed,
  getTodayStudyMinutes,
  highlightTermInExample,
  isDueForReview,
  isTypingAnswerCorrect,
  moveFirstToEnd,
  normalizeAnswer,
  scheduleCorrectReview,
  scheduleIncorrectReview,
  scheduleLearnedWord,
  selectDueWords,
  selectNewWords,
  summarizeSession,
  type StudySessionDto,
  type StudyWord,
} from "./study";

const now = new Date("2026-07-12T00:00:00.000Z");
const word = (overrides: Partial<StudyWord> = {}): StudyWord => ({
  id: "word-1",
  term: "hello",
  translation: "xin chào",
  learnedAt: null,
  reviewStage: 0,
  lastReviewedAt: null,
  nextReviewAt: null,
  reviewCompletedAt: null,
  ...overrides,
});

test("selectNewWords limits new words to requested session size", () => {
  const words = Array.from({ length: 25 }, (_, index) =>
    word({ id: String(index), learnedAt: index === 0 ? now.toISOString() : null }),
  );
  assert.equal(selectNewWords(words, 10).length, 10);
  assert.equal(selectNewWords(words, 20).length, 20);
  assert.equal(selectNewWords(words.slice(0, 6), 10).length, 5);
});

test("due selection prioritizes oldest due then never reviewed", () => {
  const words = [
    word({ id: "future", learnedAt: now.toISOString(), nextReviewAt: addDays(now, 1).toISOString() }),
    word({ id: "new", nextReviewAt: addDays(now, -10).toISOString() }),
    word({ id: "reviewed", learnedAt: now.toISOString(), nextReviewAt: addDays(now, -2).toISOString(), lastReviewedAt: addDays(now, -5).toISOString() }),
    word({ id: "never", learnedAt: now.toISOString(), nextReviewAt: addDays(now, -2).toISOString() }),
    word({ id: "oldest", learnedAt: now.toISOString(), nextReviewAt: addDays(now, -3).toISOString() }),
    word({ id: "done", learnedAt: now.toISOString(), nextReviewAt: addDays(now, -9).toISOString(), reviewCompletedAt: now.toISOString() }),
    word({ id: "mastered_by_status", status: "mastered", learnedAt: now.toISOString(), nextReviewAt: addDays(now, -9).toISOString() }),
  ];

  assert.deepEqual(selectDueWords(words, 10, now).map((item) => item.id), [
    "oldest",
    "never",
    "reviewed",
  ]);
  assert.equal(isDueForReview(words[0], now), false);
  assert.equal(isDueForReview(words[6], now), false);
  assert.ok(compareReviewPriority(words[3], words[2]) < 0);
});

test("incorrect queue item moves to end without duplication", () => {
  assert.deepEqual(moveFirstToEnd(["a", "b", "c"]), ["b", "c", "a"]);
  assert.deepEqual(moveFirstToEnd(["a"]), ["a"]);
  assert.deepEqual(moveFirstToEnd<string>([]), []);
});

test("typing normalization accepts formatting differences only", () => {
  assert.equal(normalizeAnswer("  THANK   YOU  "), "thank you");
  assert.equal(normalizeAnswer("can’t—wait"), "can't-wait");
  assert.equal(isTypingAnswerCorrect("Thank you", " thank   YOU "), true);
  assert.equal(isTypingAnswerCorrect("form", "from"), false);
  assert.equal(isTypingAnswerCorrect("hello", ""), false);
});

test("study speech is slow only during flashcards", () => {
  assert.equal(getStudySpeechSpeed("flashcard"), "slow");
  assert.equal(getStudySpeechSpeed("multiple_choice"), "normal");
  assert.equal(getStudySpeechSpeed("typing"), "normal");
});

test("example highlighting preserves text and matches literal terms", () => {
  assert.deepEqual(highlightTermInExample("Give me a Second, second.", "second"), [
    { text: "Give me a ", highlighted: false },
    { text: "Second", highlighted: true },
    { text: ", ", highlighted: false },
    { text: "second", highlighted: true },
    { text: ".", highlighted: false },
  ]);
  assert.deepEqual(highlightTermInExample("I use C++.", "C++"), [
    { text: "I use ", highlighted: false },
    { text: "C++", highlighted: true },
    { text: ".", highlighted: false },
  ]);
  assert.deepEqual(highlightTermInExample("Wait a little.", "a little"), [
    { text: "Wait ", highlighted: false },
    { text: "a little", highlighted: true },
    { text: ".", highlighted: false },
  ]);
  assert.deepEqual(highlightTermInExample("No matching word.", "second"), [
    { text: "No matching word.", highlighted: false },
  ]);
  assert.deepEqual(highlightTermInExample("Keep this text.", "  "), [
    { text: "Keep this text.", highlighted: false },
  ]);
});

test("study answers return authoritative correctness and expected answer", () => {
  assert.deepEqual(
    evaluateStudyAnswer({
      phase: "flashcard",
      wordId: "word-1",
      term: "hello",
      translation: "xin chào",
    }),
    { isCorrect: true, expectedAnswer: "xin chào" },
  );
  assert.deepEqual(
    evaluateStudyAnswer({
      phase: "multiple_choice",
      wordId: "word-1",
      term: "hello",
      translation: "xin chào",
      selectedWordId: "word-2",
    }),
    { isCorrect: false, expectedAnswer: "xin chào" },
  );
  assert.deepEqual(
    evaluateStudyAnswer({
      phase: "typing",
      wordId: "word-1",
      term: "Thank you",
      translation: "cảm ơn",
      answer: " thank   YOU ",
    }),
    { isCorrect: true, expectedAnswer: "Thank you" },
  );
});

test("study shortcuts respect phase, feedback, and option boundaries", () => {
  const shortcut = (
    key: string,
    overrides: Partial<Parameters<typeof getStudyShortcutAction>[0]> = {},
  ) =>
    getStudyShortcutAction({
      key,
      phase: "flashcard",
      hasFeedback: false,
      flashcardIndex: 1,
      optionCount: 4,
      canSpeak: true,
      ...overrides,
    });

  assert.deepEqual(shortcut("ArrowLeft"), { type: "previous-flashcard" });
  assert.equal(shortcut("ArrowLeft", { flashcardIndex: 0 }), null);
  assert.deepEqual(shortcut("ArrowRight"), { type: "next-flashcard" });
  assert.deepEqual(shortcut("1", { phase: "multiple_choice" }), {
    type: "choose-option",
    optionIndex: 0,
  });
  assert.deepEqual(shortcut("D", { phase: "multiple_choice" }), {
    type: "choose-option",
    optionIndex: 3,
  });
  assert.equal(shortcut("4", { phase: "multiple_choice", optionCount: 3 }), null);
  assert.deepEqual(shortcut("Enter", { phase: "typing", hasFeedback: true }), {
    type: "continue-feedback",
  });
  assert.equal(shortcut("Enter", { phase: "typing" }), null);
  assert.equal(shortcut("P", { phase: "typing" }), null);
  assert.deepEqual(shortcut("p", { phase: "typing", hasFeedback: true }), {
    type: "speak",
  });
  assert.deepEqual(shortcut("m"), { type: "toggle-auto-speak" });
  assert.equal(shortcut("m", { canSpeak: false }), null);
  assert.equal(shortcut("2", { phase: "multiple_choice", hasFeedback: true }), null);
});

test("multiple choice options are stable, distinct, and session-scoped", () => {
  const target = word({ id: "a", translation: "quả táo" });
  const words = [
    target,
    word({ id: "b", translation: "nước" }),
    word({ id: "c", translation: "cơm" }),
    word({ id: "d", translation: "bánh mì" }),
    word({ id: "e", translation: " NƯỚC " }),
  ];
  const first = createMultipleChoiceOptions(target, words, "session:a");
  const second = createMultipleChoiceOptions(target, words, "session:a");
  assert.deepEqual(first, second);
  assert.equal(first.length, 4);
  assert.equal(first.filter((item) => item.id === target.id).length, 1);
  assert.equal(new Set(first.map((item) => normalizeAnswer(item.translation))).size, 4);
});

test("local study results complete all phases and preserve incorrect attempts", () => {
  const session: StudySessionDto = {
    id: "session-1",
    mode: "learn",
    status: "active",
    phase: "flashcard",
    requestedSize: 10,
    selectedSize: 1,
    learnedCount: 0,
    reviewedCount: 0,
    attemptCount: 0,
    incorrectCount: 0,
    words: [
      {
        id: "word-1",
        position: 0,
        term: "hello",
        translation: "xin chào",
        phonetic: "",
        partOfSpeech: [],
        exampleSentence: "",
        exampleTranslation: "",
        flashcardCompleted: false,
        multipleChoiceCompleted: false,
        typingCompleted: false,
        incorrectAttemptCount: 0,
      },
    ],
  };
  const event = (phase: "flashcard" | "multiple_choice" | "typing", isCorrect: boolean) => ({
    wordId: "word-1",
    phase,
    isCorrect,
    expectedAnswer: "hello",
  });

  const afterFlashcard = applyStudyResult(session, event("flashcard", true));
  assert.equal(afterFlashcard.phase, "multiple_choice");
  assert.equal(afterFlashcard.attemptCount, 0);

  const afterWrongChoice = applyStudyResult(
    afterFlashcard,
    event("multiple_choice", false),
  );
  assert.equal(afterWrongChoice.phase, "multiple_choice");
  assert.equal(afterWrongChoice.words[0].incorrectAttemptCount, 1);

  const afterChoice = applyStudyResult(
    afterWrongChoice,
    event("multiple_choice", true),
  );
  assert.equal(afterChoice.phase, "typing");

  const afterWrongTyping = applyStudyResult(afterChoice, event("typing", false));
  const completed = applyStudyResult(afterWrongTyping, event("typing", true));
  assert.equal(completed.status, "completed");
  assert.equal(completed.phase, null);
  assert.equal(completed.learnedCount, 1);
  assert.equal(completed.attemptCount, 4);
  assert.equal(completed.incorrectCount, 2);
  assert.equal(completed.words[0].incorrectAttemptCount, 2);
});

test("review counts only a correct first attempt", () => {
  const session: StudySessionDto = {
    id: "session-1",
    mode: "review",
    status: "active",
    phase: "typing",
    requestedSize: 10,
    selectedSize: 1,
    learnedCount: 0,
    reviewedCount: 0,
    attemptCount: 0,
    incorrectCount: 0,
    words: [
      {
        id: "word-1",
        position: 0,
        term: "hello",
        translation: "xin chào",
        phonetic: "",
        partOfSpeech: [],
        exampleSentence: "",
        exampleTranslation: "",
        flashcardCompleted: false,
        multipleChoiceCompleted: false,
        typingCompleted: false,
        incorrectAttemptCount: 0,
      },
    ],
  };
  const result = (isCorrect: boolean) => ({
    wordId: "word-1",
    phase: "typing" as const,
    isCorrect,
    expectedAnswer: "hello",
  });

  const afterIncorrect = applyStudyResult(session, result(false));
  const afterRetryCorrect = applyStudyResult(afterIncorrect, result(true));
  const afterFirstCorrect = applyStudyResult(session, result(true));
  assert.equal(afterIncorrect.reviewedCount, 0);
  assert.equal(afterRetryCorrect.reviewedCount, 0);
  assert.equal(afterFirstCorrect.reviewedCount, 1);
});

test("review schedule advances through 3, 7, and 30 day cycle", () => {
  assert.deepEqual(scheduleLearnedWord(now), {
    reviewStage: 0,
    intervalDays: 3,
    nextReviewAt: addDays(now, 3),
    reviewCompletedAt: null,
    status: "learning",
  });
  assert.deepEqual(scheduleCorrectReview(0, false, now), {
    reviewStage: 1,
    intervalDays: 7,
    nextReviewAt: addDays(now, 7),
    reviewCompletedAt: null,
    status: "learning",
  });
  assert.deepEqual(scheduleCorrectReview(1, false, now), {
    reviewStage: 2,
    intervalDays: 30,
    nextReviewAt: addDays(now, 30),
    reviewCompletedAt: null,
    status: "learning",
  });
  assert.deepEqual(scheduleCorrectReview(2, false, now), {
    reviewStage: 3,
    intervalDays: 0,
    nextReviewAt: null,
    reviewCompletedAt: now,
    status: "mastered",
  });
});

test("incorrect review and successful retry remain due tomorrow", () => {
  assert.deepEqual(scheduleIncorrectReview(now), {
    reviewStage: 0,
    intervalDays: 1,
    nextReviewAt: addDays(now, 1),
    reviewCompletedAt: null,
    status: "learning",
  });
  assert.deepEqual(scheduleCorrectReview(2, true, now), scheduleIncorrectReview(now));
});

test("persisted attempt counts satisfy session count constraints", () => {
  assert.deepEqual(getPersistedAttemptCounts("learn", true), { correct: 2, attempts: 2 });
  assert.deepEqual(getPersistedAttemptCounts("review", true), { correct: 1, attempts: 1 });
  assert.deepEqual(getPersistedAttemptCounts("review", false), { correct: 0, attempts: 1 });
});

test("session summary counts unique words separately from attempts", () => {
  assert.deepEqual(
    summarizeSession({ selectedCount: 10, completedCount: 8, attemptCount: 15, incorrectCount: 5 }),
    {
      selectedCount: 10,
      completedCount: 8,
      remainingCount: 2,
      attemptCount: 15,
      incorrectCount: 5,
      accuracy: 67,
    },
  );
});

test("getTodayStudyMinutes calculates study time accurately", () => {
  assert.equal(getTodayStudyMinutes(undefined), 0);
  assert.equal(getTodayStudyMinutes({ reviewed: 0, learned: 0, studySeconds: 0 }), 0);
  assert.equal(getTodayStudyMinutes({ reviewed: 5, learned: 5, studySeconds: 150 }), 3);
  assert.equal(getTodayStudyMinutes({ reviewed: 5, learned: 5, studySeconds: 20 }), 1);
  assert.equal(getTodayStudyMinutes({ reviewed: 4, learned: 6, studySeconds: 0 }), 5);
});
