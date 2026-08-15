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

test("parses JSON, normalizes Unicode and preserves user capitalization", () => {
  const result = parseVocabularyImport(
    JSON.stringify([
      { term: "  café ", translation: "cà phê" },
      { term: "café", translation: "trùng" },
      { term: "Apple", translation: "quả táo", partOfSpeech: ["danh từ"] },
      { term: "Run", translation: "chạy", partOfSpeech: ["động từ"] },
    ]),
    "json",
  );
  assert.equal(result.errors.length, 0);
  assert.equal(result.words.length, 3);
  assert.equal(result.skippedDuplicates, 1);
  assert.equal(result.words[0].term, "café");
  assert.equal(result.words[1].term, "Apple");
  assert.equal(result.words[2].term, "Run");
});

test("normalizes multiple parts of speech from JSON arrays", () => {
  const result = parseVocabularyImport(
    JSON.stringify([
      {
        term: "hello",
        translation: "xin chào",
        partOfSpeech: [" thán từ ", "tính từ", "Thán từ"],
      },
      { term: "sunflower", translation: "hoa hướng dương" },
    ]),
    "json",
  );

  assert.equal(result.errors.length, 0);
  assert.deepEqual(result.words[0].partOfSpeech, ["thán từ", "tính từ"]);
  assert.deepEqual(result.words[1].partOfSpeech, []);
});

test("keeps legacy JSON strings and parses comma-separated CSV parts of speech", () => {
  const legacy = parseVocabularyImport(
    JSON.stringify([{ term: "run", translation: "chạy", partOfSpeech: "động từ" }]),
    "json",
  );
  assert.deepEqual(legacy.words[0].partOfSpeech, ["động từ"]);

  const csv = parseVocabularyImport(
    'term,translation,partOfSpeech\nhello,xin chào,"thán từ, tính từ"\n',
    "csv",
  );
  assert.equal(csv.errors.length, 0);
  assert.deepEqual(csv.words[0].partOfSpeech, ["thán từ", "tính từ"]);
});

test("reports invalid, empty and overlong parts of speech", () => {
  const result = parseVocabularyImport(
    JSON.stringify([
      {
        term: "hello",
        translation: "xin chào",
        partOfSpeech: ["thán từ", "", 12, "x".repeat(101)],
      },
    ]),
    "json",
  );

  assert.deepEqual(result.words[0].partOfSpeech, ["thán từ"]);
  assert.equal(result.errors.filter((error) => error.field === "partOfSpeech").length, 3);
});

test("reports too many parts of speech", () => {
  const result = parseVocabularyImport(
    JSON.stringify([
      {
        term: "hello",
        translation: "xin chào",
        partOfSpeech: Array.from({ length: 21 }, (_, index) => `loại ${index}`),
      },
    ]),
    "json",
  );

  assert.ok(result.errors.some((error) => error.message.includes("20 giá trị")));
});

test("reports missing required fields and invalid JSON shape", () => {
  const missing = parseVocabularyImport("term,phonetic\nhello,/həˈləʊ/", "csv");
  assert.ok(missing.errors.some((error) => error.message.includes("translation")));
  const invalid = parseVocabularyImport('{"term":"hello"}', "json");
  assert.equal(invalid.words.length, 0);
  assert.equal(invalid.errors.length, 1);
});
