import assert from "node:assert/strict";
import test from "node:test";

import { parseVocabularyImport } from "./vocabulary-import";

test("parses CSV with BOM, quoted commas and optional fields", () => {
  const result = parseVocabularyImport(
    '﻿term,translation,exampleSentence\r\nhello,"xin chào, bạn","Hello, friend"\r\n',
    "csv",
  );
  assert.equal(result.errors.length, 0);
  assert.equal(result.words.length, 1);
  assert.equal(result.words[0].translation, "xin chào, bạn");
  assert.equal(result.words[0].phonetic, "");
});

test("parses JSON, normalizes Unicode and skips duplicate terms", () => {
  const result = parseVocabularyImport(
    JSON.stringify([
      { term: "  café ", translation: "cà phê" },
      { term: "café", translation: "trùng" },
      { term: "Café", translation: "khác hoa thường" },
    ]),
    "json",
  );
  assert.equal(result.errors.length, 0);
  assert.equal(result.words.length, 2);
  assert.equal(result.skippedDuplicates, 1);
  assert.equal(result.words[0].term, "café");
});

test("reports missing required fields and invalid JSON shape", () => {
  const missing = parseVocabularyImport("term,phonetic\nhello,/həˈləʊ/", "csv");
  assert.ok(missing.errors.some((error) => error.message.includes("translation")));
  const invalid = parseVocabularyImport('{"term":"hello"}', "json");
  assert.equal(invalid.words.length, 0);
  assert.equal(invalid.errors.length, 1);
});
