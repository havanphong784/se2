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

    it("merge cẩn thận translationVi và không bị ghi đè thành rỗng", async () => {
      const { setCachedWord, getCachedWord } = await import("./dictionary-cache");

      setCachedWord("serendipity", {
        translationVi: "sự tình cờ may mắn",
      });

      // Lần cập nhật sau chỉ có definition, không có translationVi
      setCachedWord("serendipity", {
        definition: "the occurrence and development of events by chance",
        phonetic: "/ˌser.ənˈdɪp.ə.ti/",
      });

      const merged = getCachedWord("serendipity");
      assert.ok(merged);
      assert.equal(merged?.translationVi, "sự tình cờ may mắn", "translationVi phải được giữ nguyên khi merge");
      assert.equal(merged?.phonetic, "/ˌser.ənˈdɪp.ə.ti/");
      assert.ok(merged?.definition?.includes("occurrence"));
    });
  });

  describe("Phrase Matcher", () => {
    it("nhận diện đúng collocations và gom subwords tương ứng", async () => {
      const { detectPhrasesInSentence } = await import("./phrase-matcher");
      const sentence = "Artificial intelligence brings profound questions.";
      const tokens = tagSentenceWords(sentence);

      const result = detectPhrasesInSentence(sentence, tokens, [
        { phrase: "artificial intelligence", meaningVi: "trí tuệ nhân tạo" },
      ]);

      assert.ok(result.phrases.length >= 1, "Phải tìm thấy ít nhất 1 cụm từ");
      const aiPhrase = result.phrases.find(
        (p) => p.cleanPhrase === "artificial intelligence"
      );
      assert.ok(aiPhrase, "Phải match được artificial intelligence");
      assert.equal(aiPhrase?.meaningVi, "trí tuệ nhân tạo");
      assert.equal(aiPhrase?.subWords.length, 2);
      assert.equal(aiPhrase?.subWords[0].cleanWord.toLowerCase(), "artificial");
      assert.equal(aiPhrase?.subWords[1].cleanWord.toLowerCase(), "intelligence");
    });

    it("tự động gán meaningVi từ cache L1/L2 cho cụm từ NLP", async () => {
      const { setCachedWord } = await import("./dictionary-cache");
      const { detectPhrasesInSentence } = await import("./phrase-matcher");

      // Cụm từ được prefetch vào cache trước
      setCachedWord("profound questions", {
        translationVi: "những câu hỏi sâu sắc",
      });

      const sentence = "Artificial intelligence brings profound questions.";
      const tokens = tagSentenceWords(sentence);

      const result = detectPhrasesInSentence(sentence, tokens);
      const profoundPhrase = result.phrases.find(
        (p) => p.cleanPhrase === "profound questions"
      );

      assert.ok(profoundPhrase, "Phải nhận diện được cụm adjective+noun 'profound questions'");
      assert.equal(
        profoundPhrase?.meaningVi,
        "những câu hỏi sâu sắc",
        "meaningVi phải được lấy trực tiếp từ L1 cache 0ms"
      );
    });
  });

  describe("Structured Document & TOC Extraction", () => {
    it("bóc tách mục lục (TOC) và chia chunk 10 trang cho tài liệu dài", async () => {
      const { extractStructuredText } = await import("./extractors");
      const sampleBook = `## Chapter 1: Introduction to Intelligence
Artificial intelligence is rapidly transforming global industry.

## Chapter 2: Deep Neural Networks
Deep architectures allow representation learning from raw data.

## Chapter 3: Future Outlook
Organizations must adapt to cognitive automation.`;

      const { meta, chunks } = extractStructuredText(sampleBook, "AI Textbook", 1);

      assert.equal(meta.title, "AI Textbook");
      assert.ok(meta.toc.length >= 3, "Phải nhận diện được ít nhất 3 chương trong TOC");
      assert.equal(meta.toc[0].title, "Chapter 1: Introduction to Intelligence");
      assert.equal(meta.toc[1].title, "Chapter 2: Deep Neural Networks");
      assert.equal(meta.toc[2].title, "Chapter 3: Future Outlook");
      assert.ok(chunks.length >= 1, "Phải chia thành các chunks");
    });
  });

  describe("Vdoc Package & IndexedDB Persistence", () => {
    it("đóng gói đúng cấu trúc .vdoc và khôi phục từ storage", async () => {
      const { buildVdocPackage, saveVdocPackage, getVdocPackage } = await import("./indexed-storage");
      const { extractStructuredText } = await import("./extractors");

      const { meta, chunks } = extractStructuredText("Test content for vdoc package.", "Test Document", 10);
      const vdoc = buildVdocPackage({
        meta,
        chunks,
        activeChunkIndex: 0,
        lastReadSentenceId: "s-0-0",
      });

      assert.equal(vdoc.schema, "vocabloom.vdoc.v1");
      assert.equal(vdoc.version, "1.0");
      assert.equal(vdoc.id, meta.id);
      assert.equal(vdoc.sessionState.activeChunkIndex, 0);

      await saveVdocPackage(vdoc);
      const loaded = await getVdocPackage(vdoc.id);
      assert.ok(loaded);
      assert.equal(loaded?.meta.title, "Test Document");
      assert.equal(loaded?.chunks.length, chunks.length);
    });
  });
});
