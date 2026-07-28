import assert from "node:assert/strict";
import test from "node:test";

const studyModule = "./study.ts";
const { computeNextReview, summarizeSession } = (await import(
  studyModule
)) as typeof import("./study");

const now = new Date("2026-07-12T00:00:00.000Z");

test("computeNextReview schedules new and repeated cards", () => {
  assert.deepEqual(computeNextReview({ intervalDays: 0 }, "good", now), {
    intervalDays: 1,
    nextReviewAt: new Date("2026-07-13T00:00:00.000Z"),
  });
  assert.deepEqual(computeNextReview({ intervalDays: 1 }, "good", now), {
    intervalDays: 3,
    nextReviewAt: new Date("2026-07-15T00:00:00.000Z"),
  });
  assert.deepEqual(computeNextReview({ intervalDays: 2 }, "hard", now), {
    intervalDays: 3,
    nextReviewAt: new Date("2026-07-15T00:00:00.000Z"),
  });
  assert.deepEqual(computeNextReview({ intervalDays: 14 }, "again", now), {
    intervalDays: 0,
    nextReviewAt: new Date("2026-07-12T00:10:00.000Z"),
  });
});

test("summarizeSession reports rating counts and completion", () => {
  assert.deepEqual(summarizeSession(["good", "again", "hard", "good"], 6), {
    reviewed: 4,
    remaining: 2,
    again: 1,
    hard: 1,
    good: 2,
    accuracy: 75,
  });
  assert.deepEqual(summarizeSession([], 5), {
    reviewed: 0,
    remaining: 5,
    again: 0,
    hard: 0,
    good: 0,
    accuracy: 0,
  });
});
