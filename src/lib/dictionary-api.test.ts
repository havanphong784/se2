import test from "node:test";
import assert from "node:assert/strict";

import {
  extractAudioUrl,
  extractPhonetic,
  parseFreeDictionaryEntries,
  type FreeDictionaryEntry,
} from "./dictionary-api";

test("extractAudioUrl extracts first valid audio and normalizes protocol", () => {
  assert.equal(extractAudioUrl([]), null);
  assert.equal(
    extractAudioUrl([
      { text: "/test/", audio: "" },
      { text: "/test/", audio: "//ssl.gstatic.com/dictionary/static/sounds/20200429/test--_gb_1.mp3" },
    ]),
    "https://ssl.gstatic.com/dictionary/static/sounds/20200429/test--_gb_1.mp3",
  );

  assert.equal(
    extractAudioUrl([
      { text: "/hello/", audio: "https://api.dictionaryapi.dev/media/pronunciations/en/hello-uk.mp3" },
      { text: "/hello/", audio: "https://api.dictionaryapi.dev/media/pronunciations/en/hello-us.mp3" },
    ]),
    "https://api.dictionaryapi.dev/media/pronunciations/en/hello-uk.mp3",
  );
});

test("extractPhonetic handles top-level phonetic or phonetics array", () => {
  const entry1: FreeDictionaryEntry = {
    word: "cat",
    phonetic: "/kæt/",
  };
  assert.equal(extractPhonetic(entry1), "/kæt/");

  const entry2: FreeDictionaryEntry = {
    word: "cat",
    phonetics: [
      { audio: "https://..." },
      { text: "/kæt/" },
    ],
  };
  assert.equal(extractPhonetic(entry2), "/kæt/");
});

test("parseFreeDictionaryEntries maps full entry with meanings, definitions, and pos", () => {
  const mockEntries: FreeDictionaryEntry[] = [
    {
      word: "run",
      phonetic: "/rʌn/",
      phonetics: [
        { text: "/rʌn/", audio: "https://api.dictionaryapi.dev/media/pronunciations/en/run-uk.mp3" },
      ],
      meanings: [
        {
          partOfSpeech: "verb",
          definitions: [
            {
              definition: "To move swiftly on foot.",
              example: "The athletes run around the track.",
            },
            {
              definition: "To operate or function.",
            },
          ],
        },
        {
          partOfSpeech: "noun",
          definitions: [
            {
              definition: "An act or instance of running.",
              example: "I went for a five-mile run this morning.",
            },
          ],
        },
      ],
    },
  ];

  const parsed = parseFreeDictionaryEntries(mockEntries);
  assert.ok(parsed);
  assert.equal(parsed.word, "run");
  assert.equal(parsed.phonetic, "/rʌn/");
  assert.equal(parsed.audioUrl, "https://api.dictionaryapi.dev/media/pronunciations/en/run-uk.mp3");
  assert.deepEqual(parsed.partsOfSpeech, ["verb", "noun"]);
  assert.deepEqual(parsed.partsOfSpeechVi, ["động từ", "danh từ"]);
  assert.equal(parsed.definition, "To move swiftly on foot.");
  assert.equal(parsed.exampleSentence, "The athletes run around the track.");
  assert.equal(parsed.allDefinitions.length, 3);
  assert.equal(parsed.allDefinitions[0].partOfSpeechVi, "động từ");
});
