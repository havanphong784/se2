import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_DECKS } from "./demo-data";
import { getLearningData } from "./data";

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
