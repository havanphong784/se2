import assert from "node:assert/strict";
import test from "node:test";

import { deckProgress, DEMO_DECKS, isDeckAvailable, type VocabularyWord } from "./demo-data";
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

test("deck progression and availability logic unlocks started or preceding-finished decks", () => {
  // 1. First deck (index 0) is always available
  assert.equal(
    isDeckAvailable(0, { percent: 0, learned: 0 }, null),
    true,
    "first deck should always be available even with 0 progress",
  );

  // 2. Started decks are available even if the preceding deck is not 100%
  assert.equal(
    isDeckAvailable(
      1,
      { percent: 50, learned: 5 },
      { percent: 60, learnedPercent: 70 },
    ),
    true,
    "started deck with percent > 0 should be available regardless of previous deck",
  );
  assert.equal(
    isDeckAvailable(
      1,
      { percent: 0, learned: 1 },
      { percent: 20, learnedPercent: 30 },
    ),
    true,
    "started deck with learned > 0 should be available regardless of previous deck",
  );

  // 3. Unstarted deck remains locked if preceding deck is not finished
  assert.equal(
    isDeckAvailable(
      1,
      { percent: 0, learned: 0 },
      { percent: 80, learnedPercent: 90 },
    ),
    false,
    "unstarted deck should be locked when previous deck is incomplete",
  );

  // 4. Unstarted deck unlocks when preceding deck percent is >= 100
  assert.equal(
    isDeckAvailable(
      1,
      { percent: 0, learned: 0 },
      { percent: 100, learnedPercent: 100 },
    ),
    true,
    "unstarted deck should unlock when previous deck percent is >= 100",
  );

  // 5. Unstarted deck unlocks when preceding deck learnedPercent >= 100 (SRS review cycles in progress)
  assert.equal(
    isDeckAvailable(
      1,
      { percent: 0, learned: 0 },
      { percent: 50, learnedPercent: 100 },
    ),
    true,
    "unstarted deck should unlock when previous deck learnedPercent is >= 100",
  );

  // 6. End-to-end check using deckProgress with simulated deck words
  const unstartedWords: VocabularyWord[] = Array.from({ length: 4 }, (_, index) => ({
    ...DEMO_DECKS[0].words[index % DEMO_DECKS[0].words.length],
    id: `unstarted-${index}`,
    status: "new",
    learnedAt: null,
    reviewCompletedAt: null,
  }));

  const allLearnedWords: VocabularyWord[] = Array.from({ length: 4 }, (_, index) => ({
    ...DEMO_DECKS[0].words[index % DEMO_DECKS[0].words.length],
    id: `all-learned-${index}`,
    status: "learning",
    learnedAt: "2026-08-21T00:00:00Z",
    reviewCompletedAt: null,
  }));

  const prevDeckProgress = deckProgress({ ...DEMO_DECKS[0], words: allLearnedWords });
  const currentDeckProgress = deckProgress({ ...DEMO_DECKS[1], words: unstartedWords });

  assert.equal(prevDeckProgress.learnedPercent, 100);
  assert.equal(prevDeckProgress.percent, 50);
  assert.equal(currentDeckProgress.percent, 0);
  assert.equal(currentDeckProgress.learned, 0);

  assert.equal(
    isDeckAvailable(1, currentDeckProgress, prevDeckProgress),
    true,
    "subsequent deck should unlock once all words in preceding deck are learned",
  );
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
