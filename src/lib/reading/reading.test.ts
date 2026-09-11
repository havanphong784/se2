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

    it("hàn gắn câu bị xuống dòng mềm (soft wrap) không bị cắt làm 2 câu", () => {
      const wrappedSentence = `To appreciate the role that an operating system plays in
a modern computer, it is useful to consider the physical machine.
The software runs on top of it.`;

      const result = segmentText(wrappedSentence);
      assert.equal(result.paragraphs[0].sentences.length, 2, "Chỉ được tách thành đúng 2 câu");
      assert.equal(
        result.paragraphs[0].sentences[0].text,
        "To appreciate the role that an operating system plays in a modern computer, it is useful to consider the physical machine."
      );
      assert.equal(
        result.paragraphs[0].sentences[1].text,
        "The software runs on top of it."
      );
    });

    it("bảo vệ từ viết tắt và số thập phân không bị ngắt thành câu cụt", () => {
      const text = "Dr. Smith and Prof. John introduced Fig. 1.5 at approx. 3.00 PM. It was very impressive.";
      const result = segmentText(text);

      assert.equal(result.paragraphs[0].sentences.length, 2, "Chỉ được tách thành đúng 2 câu hoàn chỉnh");
      assert.equal(
        result.paragraphs[0].sentences[0].text,
        "Dr. Smith and Prof. John introduced Fig. 1.5 at approx. 3.00 PM."
      );
      assert.equal(
        result.paragraphs[0].sentences[1].text,
        "It was very impressive."
      );
    });

    it("bảo tồn gạch đầu dòng nhiều dòng (multi-line bullet points) thành một mục duy nhất", () => {
      const bulletText = `Key components:
- Electronic components (transistors,
  memory chips, etc.)
- Central processing unit (CPU)`;

      const result = segmentText(bulletText);
      const listItems = result.paragraphs.filter((p) => p.type === "list_item");
      assert.equal(listItems.length, 2, "Phải nhận diện đúng 2 list items");
      assert.ok(
        listItems[0].rawText.includes("Electronic components (transistors, memory chips, etc.)"),
        "Dòng thứ hai của bullet phải được gộp vào bullet item đầu tiên"
      );
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

    it("tạo instant draft tức thì chứa đủ cấu trúc cơ bản không bị crash", async () => {
      const { createInstantSentenceDraft } = await import("@/lib/ai/local-ai-client");
      const draft = createInstantSentenceDraft("The technology sector is growing fast.", "Ngành công nghệ đang phát triển nhanh chóng.");

      assert.equal(draft.sentence, "The technology sector is growing fast.");
      assert.equal(draft.translationVi, "Ngành công nghệ đang phát triển nhanh chóng.");
      assert.equal(draft.complexity, "simple");
      assert.ok(draft.skeleton);
      assert.ok(Array.isArray(draft.chunks));
      assert.ok(Array.isArray(draft.mentalModelSteps));
      assert.ok(draft.grammar);
      assert.equal(draft.grammar.pattern, "Đang phân tích cấu trúc...");
      assert.deepEqual(draft.vocabulary, []);
    });

    it("lưu và đọc phân tích câu từ L1 memory cache", async () => {
      const { setCachedAnalysis, getCachedAnalysis } = await import("@/lib/ai/local-ai-client");
      const sample = {
        sentence: "Learning languages expands horizons.",
        complexity: "simple" as const,
        translationVi: "Học ngôn ngữ mở rộng tầm nhìn.",
        coreIdeaVi: "Học ngôn ngữ giúp con người mở rộng tri thức và thế giới quan.",
        skeleton: {
          pattern: "S + V + O",
          parts: [
            { type: "S" as const, text: "Learning languages", roleVi: "Chủ ngữ" },
            { type: "V" as const, text: "expands", roleVi: "Động từ" },
            { type: "O" as const, text: "horizons", roleVi: "Tân ngữ" },
          ],
        },
        chunks: [
          { chunkText: "Learning languages", meaningVi: "Việc học ngôn ngữ", type: "noun_phrase" },
          { chunkText: "expands", meaningVi: "mở rộng", type: "verb_phrase" },
          { chunkText: "horizons", meaningVi: "những chân trời mới", type: "noun_phrase" },
        ],
        grammar: {
          pattern: "Simple Sentence with Gerund Subject",
          explanation: "Câu đơn với danh động từ đóng vai trò chủ ngữ.",
          ruleSummary: "V-ing (Singular Subject) + V(s/es) + Object",
          whyUsedVi: "Tác giả dùng danh động từ để nhấn mạnh hành động học như một trải nghiệm sống.",
          mechanicVi: "Danh động từ 'Learning' làm chủ ngữ số ít nên động từ 'expands' thêm 's'.",
          clauses: [],
        },
        vocabulary: [
          {
            term: "horizons",
            ipa: "/həˈraɪ.zənz/",
            partOfSpeech: "noun",
            contextMeaningVi: "tầm nhìn, chân trời",
            cefr: "B2" as const,
            isTechnicalTerm: false,
            wordFamily: [{ word: "horizontal", partOfSpeech: "adjective" }],
          },
        ],
        idiomsAndPhrases: [],
        mentalModelSteps: [
          "1. Bắt đầu với chủ thể hành động: 'Learning languages' (việc học tiếng).",
          "2. Nắm bắt động từ tác động: 'expands' (mở rộng).",
          "3. Tiếp nhận đối tượng: 'horizons' (tầm nhìn, chân trời).",
        ],
        simplifiedEnglish: "Learning new languages helps you learn more.",
      };

      setCachedAnalysis("Learning languages expands horizons.", sample);
      const cached = getCachedAnalysis("LEARNING LANGUAGES EXPANDS HORIZONS.");
      assert.ok(cached);
      assert.equal(cached?.translationVi, "Học ngôn ngữ mở rộng tầm nhìn.");
      assert.equal(cached?.coreIdeaVi, "Học ngôn ngữ giúp con người mở rộng tri thức và thế giới quan.");
      assert.equal(cached?.skeleton?.pattern, "S + V + O");
      assert.equal(cached?.skeleton?.parts.length, 3);
      assert.equal(cached?.chunks?.length, 3);
      assert.equal(cached?.grammar?.whyUsedVi, "Tác giả dùng danh động từ để nhấn mạnh hành động học như một trải nghiệm sống.");
      assert.equal(cached?.vocabulary.length, 1);
      assert.equal(cached?.vocabulary[0].term, "horizons");
      assert.equal(cached?.vocabulary[0].wordFamily?.[0].word, "horizontal");
      assert.equal(cached?.mentalModelSteps?.length, 3);
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

    it("lưu và lấy lại nguyên vẹn phân tích câu bằng saveSentenceAnalysis và getSentenceAnalysis", async () => {
      const { saveSentenceAnalysis, getSentenceAnalysis } = await import("./indexed-storage");
      const { createInstantSentenceDraft } = await import("@/lib/ai/local-ai-client");

      const docId = "doc-test-analysis-1";
      const sentence = "Artificial intelligence transforms language acquisition.";
      const draft = createInstantSentenceDraft(sentence, "Trí tuệ nhân tạo chuyển đổi việc tiếp thu ngôn ngữ.");

      await saveSentenceAnalysis(docId, sentence, draft);
      const retrieved = await getSentenceAnalysis(docId, sentence);

      assert.ok(retrieved, "Phân tích câu phải tồn tại trong IndexedDB");
      assert.equal(retrieved?.sentence, sentence);
      assert.equal(retrieved?.translationVi, "Trí tuệ nhân tạo chuyển đổi việc tiếp thu ngôn ngữ.");
      assert.deepEqual(retrieved, draft, "Dữ liệu trả về phải nguyên vẹn so với khi lưu");
    });

    it("lấy toàn bộ kết quả phân tích câu của tài liệu bằng getAllAnalysesForDocument", async () => {
      const { saveSentenceAnalysis, getAllAnalysesForDocument } = await import("./indexed-storage");
      const { createInstantSentenceDraft, getSentenceHash } = await import("@/lib/ai/local-ai-client");

      const docId = "doc-test-analysis-2";
      const otherDocId = "doc-test-other";
      const sentence1 = "First sentence for testing.";
      const sentence2 = "Second sentence for testing.";
      const otherSentence = "Other doc sentence.";

      const draft1 = createInstantSentenceDraft(sentence1, "Câu đầu tiên để kiểm thử.");
      const draft2 = createInstantSentenceDraft(sentence2, "Câu thứ hai để kiểm thử.");
      const draftOther = createInstantSentenceDraft(otherSentence, "Câu của tài liệu khác.");

      await saveSentenceAnalysis(docId, sentence1, draft1);
      await saveSentenceAnalysis(docId, sentence2, draft2);
      await saveSentenceAnalysis(otherDocId, otherSentence, draftOther);

      const allAnalyses = await getAllAnalysesForDocument(docId);
      const hash1 = getSentenceHash(sentence1);
      const hash2 = getSentenceHash(sentence2);
      const otherHash = getSentenceHash(otherSentence);

      assert.ok(allAnalyses[hash1], "Phải chứa câu 1");
      assert.ok(allAnalyses[hash2], "Phải chứa câu 2");
      assert.equal(allAnalyses[hash1]?.sentence, sentence1);
      assert.equal(allAnalyses[hash2]?.sentence, sentence2);
      assert.equal(allAnalyses[otherHash], undefined, "Không được chứa câu của tài liệu khác");
      assert.equal(Object.keys(allAnalyses).length, 2, "Chỉ được chứa đúng 2 câu của tài liệu này");
    });

    it("xóa tài liệu (cascade) sẽ xóa sạch toàn bộ các câu phân tích của tài liệu đó", async () => {
      const { saveSentenceAnalysis, getAllAnalysesForDocument, getSentenceAnalysis, deleteDocument } = await import("./indexed-storage");
      const { createInstantSentenceDraft } = await import("@/lib/ai/local-ai-client");

      const docId = "doc-test-cascade-delete";
      const keepDocId = "doc-test-cascade-keep";
      const sentence = "A sentence to be deleted.";
      const keepSentence = "A sentence to be kept.";

      const draft = createInstantSentenceDraft(sentence, "Một câu chuẩn bị bị xóa.");
      const keepDraft = createInstantSentenceDraft(keepSentence, "Một câu cần được giữ lại.");

      await saveSentenceAnalysis(docId, sentence, draft);
      await saveSentenceAnalysis(keepDocId, keepSentence, keepDraft);

      const beforeDelete = await getSentenceAnalysis(docId, sentence);
      assert.ok(beforeDelete, "Câu phải tồn tại trước khi xóa");

      // Xóa tài liệu cascade
      await deleteDocument(docId);

      // Kiểm tra câu đơn lẻ và toàn bộ câu của tài liệu bị xóa
      const afterDeleteSingle = await getSentenceAnalysis(docId, sentence);
      assert.equal(afterDeleteSingle, null, "Câu đơn lẻ của doc bị xóa phải biến mất khỏi IndexedDB");

      const afterDeleteAll = await getAllAnalysesForDocument(docId);
      assert.deepEqual(afterDeleteAll, {}, "Tất cả câu phân tích của tài liệu bị xóa phải rỗng");

      // Tài liệu khác không bị ảnh hưởng
      const keepResult = await getSentenceAnalysis(keepDocId, keepSentence);
      assert.ok(keepResult, "Câu của tài liệu khác không được bị xóa");
      assert.equal(keepResult?.sentence, keepSentence);
    });
  });

  describe("Layout & Geometry-Aware PDF Extraction", () => {
    it("trích xuất đúng tọa độ và cỡ chữ từ transform matrix của PDF.js", async () => {
      const { extractGeometryItemsFromPage } = await import("./extractors");

      const rawItems = [
        {
          str: "Title Heading",
          transform: [18, 0, 0, 18, 50, 750], // font 18, x=50, baseline y=750
          width: 150,
          height: 18,
        },
        {
          str: "Body paragraph text.",
          transform: [12, 0, 0, 12, 50, 700], // font 12, x=50, baseline y=700
          width: 200,
          height: 12,
        },
      ];

      const pageHeight = 800;
      const items = extractGeometryItemsFromPage(rawItems, pageHeight);

      assert.equal(items.length, 2);
      assert.equal(items[0].fontSize, 18);
      assert.equal(items[0].x, 50);
      assert.equal(items[0].y, 800 - 750 - 18); // top-down y = 32
      assert.equal(items[1].fontSize, 12);
      assert.equal(items[1].y, 800 - 700 - 12); // top-down y = 88
    });

    it("lọc bỏ running header, footer và số trang ở mép trang", async () => {
      const { filterHeadersAndFooters } = await import("./extractors");

      const page1 = [
        { str: "Chapter 1: Foundations", x: 50, y: 20, width: 150, height: 10, fontSize: 10 }, // header (y=20 < 45)
        { str: "Content of page 1.", x: 50, y: 150, width: 200, height: 12, fontSize: 12 },
        { str: "- 1 -", x: 250, y: 760, width: 30, height: 10, fontSize: 10 }, // page number (y=760 > 736)
      ];

      const page2 = [
        { str: "Chapter 1: Foundations", x: 50, y: 20, width: 150, height: 10, fontSize: 10 }, // recurring header
        { str: "Content of page 2.", x: 50, y: 150, width: 200, height: 12, fontSize: 12 },
        { str: "Page 2", x: 250, y: 760, width: 40, height: 10, fontSize: 10 }, // page number
      ];

      const filtered = filterHeadersAndFooters([page1, page2], 800);

      assert.equal(filtered[0].length, 1);
      assert.equal(filtered[0][0].str, "Content of page 1.");

      assert.equal(filtered[1].length, 1);
      assert.equal(filtered[1][0].str, "Content of page 2.");
    });

    it("sắp xếp thứ tự đọc chính xác cho bố cục 2 cột (XY-Cut column sorting)", async () => {
      const { sortItemsIntoReadingOrder } = await import("./extractors");

      // Cột 1: x in [50..220], Cột 2: x in [280..450] (Rãnh gutter x=220..280)
      const twoColumnItems = [
        { str: "Col1 Line 1", x: 50, y: 100, width: 150, height: 12, fontSize: 12 },
        { str: "Col2 Line 1", x: 280, y: 100, width: 150, height: 12, fontSize: 12 },
        { str: "Col1 Line 2", x: 50, y: 130, width: 150, height: 12, fontSize: 12 },
        { str: "Col2 Line 2", x: 280, y: 130, width: 150, height: 12, fontSize: 12 },
      ];

      const sorted = sortItemsIntoReadingOrder(twoColumnItems, 500);
      const texts = sorted.map((i) => i.str);

      // Phải đọc hết Cột 1 rồi mới sang Cột 2
      assert.deepEqual(texts, [
        "Col1 Line 1",
        "Col1 Line 2",
        "Col2 Line 1",
        "Col2 Line 2",
      ]);
    });

    it("bảo toàn tiêu đề toàn trang (full-width header) nằm trên bố cục 2 cột", async () => {
      const { sortItemsIntoReadingOrder } = await import("./extractors");

      const itemsWithTitle = [
        { str: "Main Article Title", x: 50, y: 40, width: 380, height: 20, fontSize: 20 }, // full width
        { str: "Left paragraph line 1", x: 50, y: 100, width: 150, height: 12, fontSize: 12 },
        { str: "Right paragraph line 1", x: 280, y: 100, width: 150, height: 12, fontSize: 12 },
        { str: "Left paragraph line 2", x: 50, y: 120, width: 150, height: 12, fontSize: 12 },
      ];

      const sorted = sortItemsIntoReadingOrder(itemsWithTitle, 500);
      const texts = sorted.map((i) => i.str);

      assert.equal(texts[0], "Main Article Title");
      assert.equal(texts[1], "Left paragraph line 1");
      assert.equal(texts[2], "Left paragraph line 2");
      assert.equal(texts[3], "Right paragraph line 1");
    });

    it("khử ngắt từ có dấu gạch nối cuối dòng (dehyphenateText)", async () => {
      const { dehyphenateText } = await import("./extractors");

      const input = "The algo-\nrithm improves perfor-\nmance significantly.";
      const result = dehyphenateText(input);

      assert.equal(result, "The algorithm improves performance significantly.");
    });

    it("tính đúng dominant font size và phân loại cấp độ heading", async () => {
      const { computeDominantFontSize, classifyTypography } = await import("./extractors");

      const pageItems = [
        { str: "Big Chapter Title", x: 50, y: 50, width: 200, height: 24, fontSize: 24 }, // 17 chars
        { str: "Section Header", x: 50, y: 100, width: 150, height: 16, fontSize: 16 }, // 14 chars
        { str: "This is a long body paragraph text that constitutes the majority of document words.", x: 50, y: 150, width: 400, height: 12, fontSize: 12 }, // 84 chars
        { str: "Another line of body text.", x: 50, y: 170, width: 200, height: 12, fontSize: 12 }, // 26 chars
      ];

      const dominant = computeDominantFontSize(pageItems);
      assert.equal(dominant, 12, "Cỡ chữ chủ đạo phải là 12pt");

      const h1 = classifyTypography(24, dominant, "Big Chapter Title");
      assert.equal(h1.isHeading, true);
      assert.equal(h1.headingLevel, 1);

      const h2 = classifyTypography(16, dominant, "Section Header");
      assert.equal(h2.isHeading, true);
      assert.equal(h2.headingLevel, 2);

      const body = classifyTypography(12, dominant, "This is regular body text.");
      assert.equal(body.isHeading, false);
    });

    it("tổng hợp dòng thành khối văn bản và đề mục hoàn chỉnh (assemblePageText)", async () => {
      const { assemblePageText } = await import("./extractors");

      const sortedItems = [
        { str: "CHAPTER 1", x: 50, y: 40, width: 100, height: 18, fontSize: 18 },
        { str: "First line of text with inter-", x: 50, y: 80, width: 200, height: 12, fontSize: 12 },
        { str: "national collaboration.", x: 50, y: 95, width: 180, height: 12, fontSize: 12 },
        { str: "Second paragraph starts here.", x: 50, y: 130, width: 220, height: 12, fontSize: 12 }, // gap Y lớn -> paragraph mới
      ];

      const dominant = 12;
      const { pageText, headings } = assemblePageText(sortedItems, dominant);

      assert.equal(headings.length, 1);
      assert.equal(headings[0].title, "CHAPTER 1");
      assert.equal(headings[0].level, 1);

      assert.ok(pageText.includes("# CHAPTER 1"));
      assert.ok(pageText.includes("First line of text with international collaboration."));
      assert.ok(pageText.includes("Second paragraph starts here."));
    });
  });
});
