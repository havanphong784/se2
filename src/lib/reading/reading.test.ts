import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tagSentenceWords } from "./pos-tagger";
import { segmentText } from "./text-segmenter";
import { getSentenceHash } from "@/lib/ai/local-ai-client";

describe("Smart Reading Utilities", () => {
  describe("POS Tagger", () => {
    it("gán nhãn đúng từ loại cho câu tiếng Anh cơ bản", () => {
      const sentence = "The quick brown fox jumps over the lazy dog.";
      const tokens = tagSentenceWords(sentence);

      assert.ok(tokens.length > 0, "Tokens không được rỗng");

      // 'The' phải là determiner
      const theToken = tokens.find((t) => t.cleanText.toLowerCase() === "the");
      assert.ok(theToken);
      assert.equal(theToken?.pos, "determiner");

      // 'jumps' phải là verb
      const jumpsToken = tokens.find((t) => t.cleanText.toLowerCase() === "jumps");
      assert.ok(jumpsToken);
      assert.equal(jumpsToken?.pos, "verb");

      // 'fox' hoặc 'dog' phải là noun
      const foxToken = tokens.find((t) => t.cleanText.toLowerCase() === "fox");
      assert.ok(foxToken);
      assert.equal(foxToken?.pos, "noun");
    });

    it("xử lý chuỗi rỗng an toàn", () => {
      const tokens = tagSentenceWords("");
      assert.deepEqual(tokens, []);
    });
  });

  describe("Text Segmenter & Semantic Blocks", () => {
    it("tách đúng đoạn văn và câu", () => {
      const text = `The first paragraph has two sentences. Here is the second sentence.

The second paragraph stands alone.`;

      const result = segmentText(text);

      assert.equal(result.paragraphs.length, 2, "Phải có đúng 2 đoạn văn");
      assert.equal(result.paragraphs[0].sentences.length, 2, "Đoạn 1 phải có 2 câu");
      assert.equal(result.paragraphs[1].sentences.length, 1, "Đoạn 2 phải có 1 câu");
      assert.ok(result.totalWords > 10, "Tổng số từ phải lớn hơn 10");
    });

    it("nhận diện đúng heading, quote và list item", () => {
      const documentText = `## 1. INTRODUCTION

> Artificial intelligence is transforming the modern landscape.

Here are key aspects:
- Enhanced productivity
- Continuous learning`;

      const result = segmentText(documentText);
      const types = result.paragraphs.map((p) => p.type);

      assert.ok(types.includes("heading"), "Phải nhận diện được heading");
      assert.ok(types.includes("quote"), "Phải nhận diện được quote");
      assert.ok(types.includes("list_item"), "Phải nhận diện được list_item");
    });

    it("khử đứt đoạn từ (de-hyphenation) khi ngắt dòng giữa chừng", () => {
      const brokenText = `The techno-
logy sector is growing fast.`;

      const result = segmentText(brokenText);
      const fullText = result.paragraphs[0].rawText;
      assert.ok(fullText.includes("technology"), "Phải ghép lại thành technology");
    });
  });

  describe("Sentence Hashing & Caching", () => {
    it("sinh ra cùng một hash cho câu giống nhau bất kể hoa thường/khoảng trắng biên", () => {
      const h1 = getSentenceHash("Rarely have we witnessed such change.");
      const h2 = getSentenceHash("  rarely have we witnessed such change.  ");
      assert.equal(h1, h2);
    });

    it("sinh ra hash khác nhau cho các câu khác nhau", () => {
      const h1 = getSentenceHash("This is sentence A.");
      const h2 = getSentenceHash("This is sentence B.");
      assert.notEqual(h1, h2);
    });
  });

  describe("Dictionary Cache", () => {
    it("lưu và đọc từ điển từ L1 memory cache", async () => {
      const { setCachedWord, getCachedWord } = await import("./dictionary-cache");

      assert.equal(getCachedWord("nonexistentword12345"), null);

      setCachedWord("resilience", {
        phonetic: "/rɪˈzɪliəns/",
        definition: "the capacity to recover quickly from difficulties",
        translationVi: "khả năng phục hồi",
      });

      const retrieved = getCachedWord("RESILIENCE");
      assert.ok(retrieved);
      assert.equal(retrieved?.phonetic, "/rɪˈzɪliəns/");
      assert.equal(retrieved?.translationVi, "khả năng phục hồi");
    });
  });
});
