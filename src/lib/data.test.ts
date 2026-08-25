import assert from "node:assert/strict";
import test from "node:test";

import { deckProgress, DEMO_DECKS, type VocabularyWord } from "./demo-data";
import { computeStreak, getLearningData } from "./data";
import { vnDateKeyOffset } from "./utils";

test("deck progress separates learned words from weighted mastery", () => {
  const words: VocabularyWord[] = Array.from({ length: 4 }, (_, index) => ({
    ...DEMO_DECKS[0].words[index % DEMO_DECKS[0].words.length],
    id: `progress-${index}`,
    status: "new",
    learnedAt: null,
    reviewCompletedAt: null,
  }));

  words[0] = { ...words[0], status: "mastered", reviewCompletedAt: "2026-08-21T00:00:00Z" };
  words[1] = { ...words[1], status: "learning", learnedAt: "2026-08-21T00:00:00Z" };

  assert.deepEqual(deckProgress({ ...DEMO_DECKS[0], words }), {
    mastered: 1,
    learning: 1,
    learned: 2,
    fresh: 2,
    percent: 38,
    learnedPercent: 50,
  });
});

test("streak best uses activity older than 30 days", () => {
  const rows = Array.from({ length: 45 }, (_, index) => ({
    activityDate: vnDateKeyOffset(index - 74),
    reviewedCount: 1,
    learnedCount: 0,
    xpEarned: 5,
  }));
  rows.push(
    ...Array.from({ length: 5 }, (_, index) => ({
      activityDate: vnDateKeyOffset(index - 4),
      reviewedCount: 1,
      learnedCount: 0,
      xpEarned: 5,
    })),
  );

  assert.deepEqual(computeStreak(rows), {
    current: 5,
    best: 45,
    status: "active",
  });
});

test("missing database configuration returns isolated demo data with metadata", async () => {
  const previousUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    const first = await getLearningData();
    assert.equal(first.source, "demo-unconfigured");
    assert.equal(first.degraded, true);
    assert.equal(first.data.decks.length, DEMO_DECKS.length);

    first.data.decks[0].title = "changed locally";
    const second = await getLearningData();
    assert.notEqual(second.data.decks[0].title, "changed locally");
    assert.equal(DEMO_DECKS[0].title, "Dụng cụ học tập");
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  }
});
