import assert from "node:assert/strict";
import test from "node:test";

import {
  addDays,
  compareReviewPriority,
  createMultipleChoiceOptions,
  evaluateStudyAnswer,
  getStudyShortcutAction,
  getStudySpeechSpeed,
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
  ];

  assert.deepEqual(selectDueWords(words, 10, now).map((item) => item.id), [
    "oldest",
    "never",
    "reviewed",
  ]);
  assert.equal(isDueForReview(words[0], now), false);
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

test("incorrect review is due tomorrow and relearning restarts at three days", () => {
  assert.deepEqual(scheduleIncorrectReview(now), {
    reviewStage: 0,
    intervalDays: 1,
    nextReviewAt: addDays(now, 1),
    reviewCompletedAt: null,
    status: "learning",
  });
  assert.deepEqual(scheduleCorrectReview(2, true, now), scheduleLearnedWord(now));
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
