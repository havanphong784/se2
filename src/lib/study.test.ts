import assert from "node:assert/strict";
import test from "node:test";

const studyModule = "./study.ts";
const {
  compareReviewPriority,
  createStudyQueue,
  computeMastery,
  computeNextReview,
  computeWordStatus,
  isDueForReview,
  summarizeSession,
} = (await import(studyModule)) as typeof import("./study");

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

test("isDueForReview honors status and review date", () => {
  assert.equal(isDueForReview({ status: "new", nextReviewAt: null }, now), true);
  assert.equal(isDueForReview({ status: "learning", nextReviewAt: null }, now), true);
  assert.equal(isDueForReview({ status: "mastered", nextReviewAt: null }, now), false);
  assert.equal(
    isDueForReview({ status: "learning", nextReviewAt: "2026-07-11T23:59:00.000Z" }, now),
    true,
  );
  assert.equal(
    isDueForReview({ status: "mastered", nextReviewAt: "2026-07-11T23:59:00.000Z" }, now),
    true,
  );
  assert.equal(
    isDueForReview({ status: "mastered", nextReviewAt: "2026-07-13T00:00:00.000Z" }, now),
    false,
  );
  assert.equal(
    isDueForReview({ status: "learning", nextReviewAt: "not-a-date" }, now),
    false,
  );
});

test("compareReviewPriority sorts status first and oldest due date within a status", () => {
  const cards = [
    { id: "mastered", status: "mastered" as const, nextReviewAt: "2026-07-01T00:00:00.000Z" },
    { id: "learning-newer", status: "learning" as const, nextReviewAt: "2026-07-11T00:00:00.000Z" },
    { id: "new", status: "new" as const, nextReviewAt: null },
    { id: "learning-older", status: "learning" as const, nextReviewAt: "2026-07-09T00:00:00.000Z" },
  ];

  assert.deepEqual(
    cards.sort(compareReviewPriority).map((card) => card.id),
    ["learning-older", "learning-newer", "new", "mastered"],
  );
});

test("createStudyQueue prioritizes reviews and limits new cards", () => {
  const cards = [
    ...Array.from({ length: 18 }, (_, index) => ({
      id: `review-${index}`,
      status: "learning" as const,
      nextReviewAt: new Date(now.getTime() - index * 60_000).toISOString(),
    })),
    ...Array.from({ length: 10 }, (_, index) => ({
      id: `new-${index}`,
      status: "new" as const,
      nextReviewAt: null,
    })),
    {
      id: "future",
      status: "mastered" as const,
      nextReviewAt: "2026-07-13T00:00:00.000Z",
    },
  ];

  const queue = createStudyQueue(cards, now);
  assert.equal(queue.length, 20);
  assert.equal(queue.filter((card) => card.status === "new").length, 2);
  assert.equal(queue[0].id, "review-17");
  assert.equal(queue.some((card) => card.id === "future"), false);
});

test("createStudyQueue admits at most five new cards when review load is low", () => {
  const cards = [
    {
      id: "review",
      status: "learning" as const,
      nextReviewAt: "2026-07-11T00:00:00.000Z",
    },
    ...Array.from({ length: 9 }, (_, index) => ({
      id: `new-${index}`,
      status: "new" as const,
      nextReviewAt: null,
    })),
  ];

  const queue = createStudyQueue(cards, now);
  assert.deepEqual(
    queue.map((card) => card.id),
    ["review", "new-0", "new-1", "new-2", "new-3", "new-4"],
  );
});

test("computeMastery scales the again penalty", () => {
  assert.equal(computeMastery(100, "again"), 90);
  assert.equal(computeMastery(82, "again"), 72);
  assert.equal(computeMastery(79, "again"), 59);
  assert.equal(computeMastery(50, "again"), 20);
  assert.equal(computeMastery(16, "again"), 0);
  assert.equal(computeMastery(50, "hard"), 56);
  assert.equal(computeMastery(90, "good"), 100);
});

test("computeWordStatus gives mastered cards hysteresis after one miss", () => {
  assert.equal(computeWordStatus("mastered", 72), "mastered");
  assert.equal(computeWordStatus("mastered", 59), "learning");
  assert.equal(computeWordStatus("learning", 72), "learning");
  assert.equal(computeWordStatus("learning", 80), "mastered");
  assert.equal(computeWordStatus("new", 0), "new");
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
