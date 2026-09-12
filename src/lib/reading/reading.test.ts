import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tagSentenceWords } from "./pos-tagger";
import { segmentText } from "./text-segmenter";
import { getSentenceHash } from "@/lib/ai/local-ai-client";
import { buildSlidingWindowContext } from "./context-window";
import {
  repairTruncatedJson,
  safeParseSentenceBreakdown,
  enrichSentenceBreakdown,
  ROLE_MAP,
} from "@/lib/ai/json-repair";
import { setCachedWord } from "./dictionary-cache";

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

    it("isCompleteSentenceAnalysis từ chối createInstantSentenceDraft (trả về false)", async () => {
      const { createInstantSentenceDraft, isCompleteSentenceAnalysis } = await import("@/lib/ai/local-ai-client");
      const draft = createInstantSentenceDraft("The technology sector is growing fast.", "Ngành công nghệ đang phát triển nhanh chóng.");
      assert.equal(isCompleteSentenceAnalysis(draft), false);
      assert.equal(isCompleteSentenceAnalysis(null), false);
      assert.equal(isCompleteSentenceAnalysis(undefined), false);
    });

    it("isCompleteSentenceAnalysis chấp nhận kết quả phân tích AI hoàn chỉnh (trả về true)", async () => {
      const { isCompleteSentenceAnalysis } = await import("@/lib/ai/local-ai-client");
      const completeAnalysis = {
        sentence: "The quick brown fox jumps over the lazy dog.",
        translationVi: "Con cáo nâu nhanh nhẹn nhảy qua con chó lười.",
        coreIdeaVi: "Hành động con cáo nhảy qua con chó.",
        skeleton: {
          pattern: "S + V + A",
          parts: [
            { type: "S" as const, text: "The quick brown fox", roleVi: "Chủ ngữ" },
            { type: "V" as const, text: "jumps", roleVi: "Động từ" },
            { type: "A" as const, text: "over the lazy dog", roleVi: "Trạng ngữ" },
          ],
        },
        clauses: [
          {
            clauseText: "The quick brown fox jumps over the lazy dog",
            role: "Main Clause",
            subject: "The quick brown fox",
            verb: "jumps",
            objectOrComplement: "over the lazy dog",
          },
        ],
        grammar: {
          pattern: "S + V + A",
          explanation: "Câu đơn",
          ruleSummary: "",
          whyUsedVi: "",
          mechanicVi: "",
          clauses: [
            {
              clauseText: "The quick brown fox jumps over the lazy dog",
              role: "Main Clause",
              subject: "The quick brown fox",
              verb: "jumps",
              objectOrComplement: "over the lazy dog",
            },
          ],
        },
        chunks: [],
        vocabulary: [],
        idiomsAndPhrases: [],
      };
      assert.equal(isCompleteSentenceAnalysis(completeAnalysis), true);
    });

    it("safeParseSentenceBreakdown gán đúng mệnh đề cho cả result.clauses và result.grammar.clauses", () => {
      const rawJson = JSON.stringify({
        sentence: "Although it was raining, they went for a hike.",
        translationVi: "Dù trời mưa, họ vẫn đi leo núi.",
        clauses: [
          {
            clauseText: "Although it was raining",
            role: "Adverbial Clause of Concession",
            subject: "it",
            verb: "was raining",
            objectOrComplement: "",
          },
          {
            clauseText: "they went for a hike",
            role: "Main Clause",
            subject: "they",
            verb: "went",
            objectOrComplement: "for a hike",
          },
        ],
        grammar: {
          pattern: "Complex Sentence",
          ruleSummary: "Concession Clause with Although",
          whyUsedVi: "Thể hiện sự đối lập giữa thời tiết và hành động",
          mechanicVi: "Mệnh đề trạng ngữ đi trước mệnh đề chính",
        },
      });

      const result = safeParseSentenceBreakdown(rawJson, "Although it was raining, they went for a hike.");
      assert.ok(result.clauses);
      assert.equal(result.clauses.length, 2);
      assert.equal(result.clauses[0].clauseText, "Although it was raining");
      assert.ok(result.grammar.clauses);
      assert.equal(result.grammar.clauses.length, 2);
      assert.equal(result.grammar.clauses[0].clauseText, "Although it was raining");
      assert.deepEqual(result.clauses, result.grammar.clauses);
    });

    it("analyzeSentence trả về ngay kết quả từ cache L1 mà không gọi network nếu isCompleteSentenceAnalysis(cached) === true", async () => {
      const { analyzeSentence, setCachedAnalysis } = await import("@/lib/ai/local-ai-client");

      const testSentence = "Cache hit verification sentence.";
      const cachedData = {
        sentence: testSentence,
        translationVi: "Câu kiểm tra nhận diện cache.",
        coreIdeaVi: "Kiểm tra cache L1 hit không gọi mạng.",
        skeleton: {
          pattern: "S + V + O",
          parts: [{ type: "S" as const, text: "Cache", roleVi: "Chủ ngữ" }],
        },
        clauses: [],
        grammar: {
          pattern: "Simple",
          explanation: "Test",
          ruleSummary: "",
          whyUsedVi: "",
          mechanicVi: "",
          clauses: [],
        },
        chunks: [],
        vocabulary: [],
        idiomsAndPhrases: [],
      };

      setCachedAnalysis(testSentence, cachedData);

      // Cấu hình AI với baseUrl không tồn tại để chứng minh nếu gọi network sẽ văng lỗi ngay
      const dummyConfig = {
        provider: "local_tunnel" as const,
        baseUrl: "http://invalid-endpoint-that-would-fail:9999/v1",
        model: "mock-model",
        temperature: 0.1,
      };

      // Nếu analyzeSentence chạm tới network thì sẽ throw do URL không tồn tại
      const result = await analyzeSentence(testSentence, "Context", dummyConfig);
      assert.equal(result.sentence, testSentence);
      assert.equal(result.translationVi, "Câu kiểm tra nhận diện cache.");
      assert.equal(result.coreIdeaVi, "Kiểm tra cache L1 hit không gọi mạng.");
    });

    it("hasCachedAnalysis trả về false đối với câu mới hoặc draft, và trả về true khi đã có phân tích hoàn chỉnh", async () => {
      const {
        hasCachedAnalysis,
        setCachedAnalysis,
        createInstantSentenceDraft,
        clearSentenceAnalysisCache,
      } = await import("@/lib/ai/local-ai-client");

      clearSentenceAnalysisCache();

      const newSentence = "Brand new sentence that has never been analyzed.";
      // 1. Câu hoàn toàn mới
      assert.equal(hasCachedAnalysis(newSentence), false);

      // 2. Câu chỉ có instant draft trong cache
      const draft = createInstantSentenceDraft(newSentence, "Bản nháp tạm");
      setCachedAnalysis(newSentence, draft);
      assert.equal(hasCachedAnalysis(newSentence), false, "Draft không được coi là đã phân tích");

      // 3. Câu có phân tích hoàn chỉnh
      const complete = {
        sentence: newSentence,
        translationVi: "Bản dịch hoàn chỉnh",
        coreIdeaVi: "Ý chính hoàn chỉnh",
        skeleton: {
          pattern: "S + V",
          parts: [{ type: "S" as const, text: "Brand new sentence", roleVi: "Chủ ngữ" }],
        },
        clauses: [],
        grammar: {
          pattern: "S + V",
          explanation: "Câu hoàn chỉnh",
          ruleSummary: "",
          whyUsedVi: "",
          mechanicVi: "",
          clauses: [],
        },
        chunks: [],
        vocabulary: [],
        idiomsAndPhrases: [],
      };
      setCachedAnalysis(newSentence, complete);
      assert.equal(hasCachedAnalysis(newSentence), true, "Phân tích hoàn chỉnh phải trả về true");
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

  describe("Context Feeding & Sliding Window", () => {
    it("hỗ trợ câu đầu tiên (không có câu trước) và câu sau", () => {
      const sentences = [
        "First sentence of the text.",
        "Second sentence following it.",
        "Third sentence here.",
      ];
      const result = buildSlidingWindowContext(sentences, 0);

      assert.ok(result.includes("<context_before></context_before>"), "Câu đầu tiên không có context_before");
      assert.ok(result.includes("<target_sentence>\nFirst sentence of the text.\n</target_sentence>"));
      assert.ok(result.includes("<context_after>\nSecond sentence following it.\n</context_after>"));
      assert.ok(result.includes("<client_hints></client_hints>"));
    });

    it("hỗ trợ câu cuối cùng (không có câu sau) và 1-2 câu trước", () => {
      const sentences = [
        "Sentence number one.",
        "Sentence number two.",
        "Sentence number three (last).",
      ];
      const result = buildSlidingWindowContext(sentences, 2);

      assert.ok(
        result.includes("<context_before>\nSentence number one. Sentence number two.\n</context_before>")
      );
      assert.ok(result.includes("<target_sentence>\nSentence number three (last).\n</target_sentence>"));
      assert.ok(result.includes("<context_after></context_after>"), "Câu cuối cùng không có context_after");
    });

    it("sliding window 1-2 câu trước xuyên suốt các paragraph", () => {
      const allSentences = [
        { id: "s1", text: "Paragraph 1 Sentence 1.", paragraphIndex: 0, tokens: [] },
        { id: "s2", text: "Paragraph 1 Sentence 2.", paragraphIndex: 0, tokens: [] },
        { id: "s3", text: "Paragraph 2 Sentence 1.", paragraphIndex: 1, tokens: [] },
        { id: "s4", text: "Paragraph 2 Sentence 2.", paragraphIndex: 1, tokens: [] },
      ];

      // Chọn câu s3 (câu đầu tiên của paragraph 2)
      const result = buildSlidingWindowContext(allSentences, 2);

      // Phải lấy được 2 câu trước đó từ paragraph 1
      assert.ok(
        result.includes("<context_before>\nParagraph 1 Sentence 1. Paragraph 1 Sentence 2.\n</context_before>"),
        "Sliding window phải xuyên paragraph lấy đủ 2 câu trước"
      );
      assert.ok(result.includes("<target_sentence>\nParagraph 2 Sentence 1.\n</target_sentence>"));
      assert.ok(result.includes("<context_after>\nParagraph 2 Sentence 2.\n</context_after>"));
    });

    it("mớm client_hints với danh sách detected phrases", () => {
      const sentences = ["He decided to turn down the offer."];
      const detectedPhrases = [
        { cleanPhrase: "turn down", phraseText: "turn down" },
        "the offer",
      ];
      const result = buildSlidingWindowContext(sentences, 0, detectedPhrases);

      assert.ok(result.includes("<client_hints>\nDetected phrases: turn down, the offer\n</client_hints>"));
    });
  });

  describe("JSON Repair & Fault-Tolerant Parsing", () => {
    it("vá JSON bị cắt cụt giữa chừng trong chuỗi (unfinished string)", () => {
      const brokenJson = '{"complexity": "simple", "translationVi": "Đây là bản dịch đang dở';
      const repaired = repairTruncatedJson(brokenJson);

      const parsed = JSON.parse(repaired);
      assert.equal(parsed.complexity, "simple");
      assert.equal(parsed.translationVi, "Đây là bản dịch đang dở");
    });

    it("vá JSON lồng nhau bị cắt cụt (unclosed nested objects and arrays)", () => {
      const brokenJson =
        '{"coreIdeaVi": "Học tiếng Anh", "skeleton": {"pattern": "S+V", "parts": [{"type": "S", "text": "Learning"';
      const repaired = repairTruncatedJson(brokenJson);

      const parsed = JSON.parse(repaired);
      assert.equal(parsed.coreIdeaVi, "Học tiếng Anh");
      assert.equal(parsed.skeleton?.pattern, "S+V");
      assert.equal(parsed.skeleton?.parts?.[0]?.text, "Learning");
    });

    it("vá JSON có dấu phẩy treo ở cuối (dangling comma)", () => {
      const brokenJson = '{"complexity": "simple", "chunks": [{"chunkText": "run fast"}, ';
      const repaired = repairTruncatedJson(brokenJson);

      const parsed = JSON.parse(repaired);
      assert.equal(parsed.chunks.length, 1);
      assert.equal(parsed.chunks[0].chunkText, "run fast");
    });

    it("vá JSON bị cắt cụt ở key dở dang bằng cơ chế backtrack", () => {
      const brokenJson = '{"translationVi": "Bản dịch", "whyUsed';
      const repaired = repairTruncatedJson(brokenJson);

      const parsed = JSON.parse(repaired);
      assert.equal(parsed.translationVi, "Bản dịch");
      assert.equal(parsed.whyUsed, undefined);
    });

    it("bóc tách khối markdown code block ```json", () => {
      const wrapped = '```json\n{"translationVi": "Thành công"}\n```';
      const repaired = repairTruncatedJson(wrapped);

      const parsed = JSON.parse(repaired);
      assert.equal(parsed.translationVi, "Thành công");
    });

    it("trả về {} an toàn cho chuỗi rỗng hoặc không chứa cấu trúc JSON", () => {
      assert.equal(repairTruncatedJson(""), "{}");
      assert.equal(repairTruncatedJson("502 Bad Gateway error from proxy"), "{}");
    });
  });

  describe("Safe Parse Sentence Breakdown & Fallback", () => {
    it("tự động điền đầy đủ fallback an toàn khi JSON hỏng hoàn toàn, không bao giờ crash", () => {
      const targetSentence = "Artificial intelligence empowers human capability.";
      const brokenRaw = "Internal Server Error 500: Model failed to respond";

      const result = safeParseSentenceBreakdown(brokenRaw, targetSentence);

      assert.equal(result.sentence, targetSentence);
      assert.equal(result.complexity, "simple");
      assert.equal(result.translationVi, "");
      assert.equal(result.skeleton?.pattern, "S + V + O");
      assert.ok(Array.isArray(result.skeleton?.parts));
      assert.ok(Array.isArray(result.chunks));
      assert.ok(Array.isArray(result.clauses));
      assert.ok(result.grammar);
      assert.equal(result.grammar.pattern, "Standard Structure");
      assert.ok(Array.isArray(result.vocabulary));
      assert.ok(Array.isArray(result.idiomsAndPhrases));
      assert.ok(Array.isArray(result.mentalModelSteps));
    });

    it("bù đắp các trường bị thiếu trong JSON dở dang", () => {
      const partialJson = JSON.stringify({
        translationVi: "Bản dịch thử nghiệm",
        coreIdeaVi: "Ý chính ngắn gọn",
      });

      const result = safeParseSentenceBreakdown(partialJson, "Test sentence.");

      assert.equal(result.sentence, "Test sentence.");
      assert.equal(result.translationVi, "Bản dịch thử nghiệm");
      assert.equal(result.coreIdeaVi, "Ý chính ngắn gọn");
      assert.equal(result.skeleton?.pattern, "S + V + O");
      assert.deepEqual(result.vocabulary, []);
    });
  });

  describe("Client-side IPA & roleVi Enrichment", () => {
    it("tự động tra và gán phiên âm IPA chuẩn từ dictionary-cache cho từ vựng", () => {
      setCachedWord("horizons", { phonetic: "/həˈraɪ.zənz/" });

      const breakdown = safeParseSentenceBreakdown(
        JSON.stringify({
          translationVi: "Mở rộng tầm nhìn",
          vocabulary: [
            {
              term: "horizons",
              partOfSpeech: "noun",
              contextMeaningVi: "chân trời, tầm nhìn",
            },
          ],
        }),
        "Learning languages expands horizons."
      );

      assert.equal(breakdown.vocabulary.length, 1);
      assert.equal(breakdown.vocabulary[0].term, "horizons");
      assert.equal(
        breakdown.vocabulary[0].ipa,
        "/həˈraɪ.zənz/",
        "Phải tự động lấy IPA từ dictionary-cache nếu AI không trả về"
      );
    });

    it("gán đúng roleVi cho skeleton.parts theo ROLE_MAP", () => {
      const breakdown = safeParseSentenceBreakdown(
        JSON.stringify({
          skeleton: {
            pattern: "S + V + O + A + C",
            parts: [
              { type: "S", text: "Developers" },
              { type: "V", text: "build" },
              { type: "O", text: "software" },
              { type: "A", text: "efficiently" },
              { type: "C", text: "reliable" },
            ],
          },
        }),
        "Developers build software efficiently reliable."
      );

      assert.equal(breakdown.skeleton?.parts[0].roleVi, ROLE_MAP["S"]);
      assert.equal(breakdown.skeleton?.parts[1].roleVi, ROLE_MAP["V"]);
      assert.equal(breakdown.skeleton?.parts[2].roleVi, ROLE_MAP["O"]);
      assert.equal(breakdown.skeleton?.parts[3].roleVi, ROLE_MAP["A"]);
      assert.equal(breakdown.skeleton?.parts[4].roleVi, ROLE_MAP["C"]);
    });

    it("enrichSentenceBreakdown giữ nguyên roleVi và IPA nếu đã có sẵn", () => {
      const customBreakdown = {
        sentence: "He runs.",
        complexity: "simple" as const,
        translationVi: "Anh ấy chạy.",
        skeleton: {
          pattern: "S + V",
          parts: [{ type: "S" as const, text: "He", roleVi: "Chủ từ đặc biệt" }],
        },
        grammar: {
          pattern: "S + V",
          explanation: "",
          clauses: [],
        },
        vocabulary: [
          {
            term: "runs",
            ipa: "/rʌnz_custom/",
            partOfSpeech: "verb",
            contextMeaningVi: "chạy",
          },
        ],
        idiomsAndPhrases: [],
      };

      const enriched = enrichSentenceBreakdown(customBreakdown);
      assert.equal(enriched.skeleton?.parts[0].roleVi, "Chủ từ đặc biệt");
      assert.equal(enriched.vocabulary[0].ipa, "/rʌnz_custom/");
    });
  });

  describe("Offline Lexicon & Tech Vocabulary Cache", () => {
    it("nạp sẵn từ vựng chuyên ngành CS/OS với IPA và nghĩa chuẩn", async () => {
      const { seedOfflineLexicon, getCachedWord } = await import("./dictionary-cache");
      seedOfflineLexicon();

      const os = getCachedWord("operating system");
      assert.ok(os);
      assert.equal(os.phonetic, "/ˈɑːpəreɪtɪŋ ˈsɪstəm/");
      assert.equal(os.translationVi, "hệ điều hành");

      const throughput = getCachedWord("throughput");
      assert.ok(throughput);
      assert.equal(throughput.phonetic, "/ˈθruːpʊt/");

      const superscalar = getCachedWord("superscalar");
      assert.ok(superscalar);
      assert.equal(superscalar.phonetic, "/ˌsuːpərˈskeɪlər/");
    });
  });

  describe("Speculative Prefetch Queue", () => {
    it("quản lý hàng đợi và hỗ trợ hủy (cancel) an toàn", async () => {
      const { SpeculativePrefetchQueue } = await import("./prefetch-queue");
      let prefetchedCount = 0;

      const queue = new SpeculativePrefetchQueue({
        debounceMs: 50,
        maxLookahead: 2,
        onSentencePrefetched: () => {
          prefetchedCount++;
        },
      });

      assert.equal(queue.getIsRunning(), false);

      const mockSentences = [
        { id: "s1", text: "Sentence 1.", cleanText: "Sentence 1.", paragraphIndex: 0, orderInParagraph: 0, wordCount: 2, tokens: [] },
        { id: "s2", text: "Sentence 2.", cleanText: "Sentence 2.", paragraphIndex: 0, orderInParagraph: 1, wordCount: 2, tokens: [] },
        { id: "s3", text: "Sentence 3.", cleanText: "Sentence 3.", paragraphIndex: 0, orderInParagraph: 2, wordCount: 2, tokens: [] },
      ];

      queue.enqueue(
        mockSentences,
        0,
        {
          provider: "local_tunnel",
          baseUrl: "http://localhost:11434/v1",
          model: "qwen2.5:3b",
          temperature: 0.1,
          autoAnalyzeOnClick: true,
        },
        "doc-test"
      );

      assert.equal(queue.getIsRunning(), true);
      queue.cancel();
      assert.equal(queue.getIsRunning(), false);
      assert.equal(prefetchedCount, 0);
    });
  });
});
