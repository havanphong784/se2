"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Settings2,
  FilePlus2,
  Menu,
  Save,
  Check,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InteractiveReader } from "@/components/reading/interactive-reader";
import { SentenceBreakdownCard } from "@/components/reading/sentence-breakdown-card";
import { DocumentImporter } from "@/components/reading/document-importer";
import { AIConfigModal } from "@/components/reading/ai-config-modal";
import { DocumentTocSidebar } from "@/components/reading/document-toc-sidebar";
import { ChunkPaginationBar } from "@/components/reading/chunk-pagination-bar";
import { segmentText } from "@/lib/reading/text-segmenter";
import { prefetchDocumentWords } from "@/lib/reading/dictionary-cache";
import { detectPhrasesInSentence } from "@/lib/reading/phrase-matcher";
import { extractStructuredText } from "@/lib/reading/extractors";
import {
  getAllDocumentsMeta,
  getDocumentChunk,
  getDocumentMeta,
  getAllDocumentChunks,
  updateReadingProgress,
  deleteDocument,
  saveStructuredDocument,
  saveVdocPackage,
  buildVdocPackage,
} from "@/lib/reading/indexed-storage";
import {
  getSavedAIConfig,
  analyzeSentence,
  getCachedAnalysis,
} from "@/lib/ai/local-ai-client";
import type {
  SentenceItem,
  SentenceBreakdownResponse,
  ClientAIConfig,
  StructuredDocumentMeta,
  DocumentChunk,
  TableOfContentItem,
} from "@/types/reading";

const SAMPLE_TEXT = `## 1. INTRODUCTION

The rapid advance of artificial intelligence has raised profound questions about the future of work. Rarely have engineers and scholars witnessed technological shifts occurring at such an unprecedented velocity.

While some routine occupations may gradually diminish, modern organizations must foster human resilience and adaptability. By integrating cutting-edge tools with creative problem-solving, individuals can unlock extraordinary potential and thrive in this evolving landscape.

## 2. FOUNDATIONAL ARCHITECTURES

Deep neural networks and large language models represent a paradigm shift in human-computer collaboration. Unlike traditional software that requires explicit programming rules, modern foundation models generalize across diverse domains through contextual representations.

Key architectural dimensions include:
- Multi-head self-attention mechanisms allowing global context capture
- Dense feed-forward layers encoding parametric knowledge
- Layer normalization and residual shortcuts ensuring gradient stability

## 3. IMPLICATIONS FOR THE WORKFORCE

As cognitive automation accelerates, professionals must transition from procedural execution to strategic direction. Cultivating continuous learning habits will determine long-term adaptability in competitive industries.`;

export default function ReadingPage() {
  const [documentMeta, setDocumentMeta] = useState<StructuredDocumentMeta | null>(null);
  const [activeChunk, setActiveChunk] = useState<DocumentChunk | null>(null);
  const [activeChunkIndex, setActiveChunkIndex] = useState<number>(0);
  const [allSavedDocs, setAllSavedDocs] = useState<StructuredDocumentMeta[]>([]);

  const [isImporting, setIsImporting] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [aiConfig, setAiConfig] = useState<ClientAIConfig>(() => getSavedAIConfig());
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Tải tài liệu đã lưu từ IndexedDB khi khởi động
  useEffect(() => {
    let mounted = true;

    async function initStorage() {
      try {
        const docs = await getAllDocumentsMeta();
        if (!mounted) return;

        if (docs.length > 0) {
          setAllSavedDocs(docs);
          const latestDoc = docs[0];
          const chunkIdx = latestDoc.activeChunkIndex || 0;
          const chunk = await getDocumentChunk(latestDoc.id, chunkIdx);
          if (mounted && chunk) {
            setDocumentMeta(latestDoc);
            setActiveChunkIndex(chunkIdx);
            setActiveChunk(chunk);
            return;
          }
        }

        // Nếu chưa có tài liệu nào, khởi tạo tài liệu mẫu có phân chương
        const { meta, chunks } = extractStructuredText(
          SAMPLE_TEXT,
          "The Impact of Artificial Intelligence & Modern Architectures",
          10,
          "raw_text"
        );
        await saveStructuredDocument(meta, chunks);
        if (mounted) {
          setDocumentMeta(meta);
          setActiveChunkIndex(0);
          setActiveChunk(chunks[0]);
          setAllSavedDocs([meta]);
        }
      } catch (err) {
        console.warn("Storage init fallback:", err);
      }
    }

    initStorage();

    return () => {
      mounted = false;
    };
  }, []);

  // Nội dung raw của Chunk hiện tại
  const rawContent = useMemo(() => {
    return activeChunk?.rawText || SAMPLE_TEXT;
  }, [activeChunk]);

  // Phân đoạn văn bản của Chunk hiện tại
  const parsedData = useMemo(() => segmentText(rawContent), [rawContent]);

  // Lưu ID của câu đang chọn
  const [selectedSentenceId, setSelectedSentenceId] = useState<string | null>(null);

  // Derive activeSentence từ parsedData và selectedSentenceId
  const activeSentence = useMemo(() => {
    const allSentences = parsedData.paragraphs.flatMap((p) => p.sentences);
    if (allSentences.length === 0) return null;
    if (!selectedSentenceId) return allSentences[0];
    return allSentences.find((s) => s.id === selectedSentenceId) || allSentences[0];
  }, [parsedData, selectedSentenceId]);

  // Kết quả phân tích và trạng thái
  const [analysisData, setAnalysisData] = useState<SentenceBreakdownResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Map từ vựng theo ngữ cảnh để popover hiển thị tức thì
  const [contextVocabMap, setContextVocabMap] = useState<
    Record<string, { meaning: string; ipa: string }>
  >({});

  // Background Prefetch ngầm các từ vựng và cụm từ trong Chunk hiện tại
  useEffect(() => {
    const allWords: string[] = [];
    const allPhrases: string[] = [];

    for (const block of parsedData.paragraphs) {
      for (const sent of block.sentences) {
        for (const token of sent.tokens) {
          if (token.isWord && token.cleanText) {
            allWords.push(token.cleanText);
          }
        }
        const detected = detectPhrasesInSentence(sent.text, sent.tokens);
        for (const p of detected.phrases) {
          allPhrases.push(p.cleanPhrase);
        }
      }
    }

    if (allWords.length > 0 || allPhrases.length > 0) {
      prefetchDocumentWords(allWords, allPhrases);
    }
  }, [parsedData]);

  // Phân tích câu đang chọn
  const handleAnalyzeSentence = useCallback(
    async (sentence: SentenceItem) => {
      setSelectedSentenceId(sentence.id);
      setAnalysisError(null);

      // Tìm ngữ cảnh paragraph của câu
      const para = parsedData.paragraphs.find((p) => p.index === sentence.paragraphIndex);
      const paraContext = para
        ? para.sentences.map((s) => s.text).join(" ")
        : sentence.text;

      // 1. Kiểm tra cache
      const cached = getCachedAnalysis(sentence.text);
      if (cached) {
        setAnalysisData(cached);
        if (cached.vocabulary && cached.vocabulary.length > 0) {
          setContextVocabMap((prev) => {
            const next = { ...prev };
            cached.vocabulary.forEach((v) => {
              next[v.term.toLowerCase()] = { meaning: v.contextMeaningVi, ipa: v.ipa };
            });
            return next;
          });
        }
        return;
      }

      // 2. Gọi AI
      setIsAnalyzing(true);
      try {
        const result = await analyzeSentence(sentence.text, paraContext, aiConfig);
        setAnalysisData(result);

        if (result.vocabulary && result.vocabulary.length > 0) {
          setContextVocabMap((prev) => {
            const next = { ...prev };
            result.vocabulary.forEach((v) => {
              next[v.term.toLowerCase()] = { meaning: v.contextMeaningVi, ipa: v.ipa };
            });
            return next;
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setAnalysisError(msg);
        setAnalysisData(null);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [aiConfig, parsedData]
  );

  // Chuyển sang một Chunk bất kỳ (Lazy Load từ IndexedDB)
  const handleSelectChunk = useCallback(
    async (targetChunkIndex: number) => {
      if (!documentMeta) return;
      if (targetChunkIndex < 0 || targetChunkIndex >= documentMeta.totalChunks) return;

      try {
        const chunk = await getDocumentChunk(documentMeta.id, targetChunkIndex);
        if (chunk) {
          setActiveChunkIndex(targetChunkIndex);
          setActiveChunk(chunk);
          setSelectedSentenceId(null);
          setAnalysisData(null);
          await updateReadingProgress(documentMeta.id, targetChunkIndex);
        }
      } catch (e) {
        console.warn("Could not load chunk:", e);
      }
    },
    [documentMeta]
  );

  // Chuyển sang mục trong Table of Contents
  const handleSelectTocItem = useCallback(
    async (item: TableOfContentItem) => {
      await handleSelectChunk(item.chunkIndex);
    },
    [handleSelectChunk]
  );

  // Chuyển sang tài liệu khác trong thư viện
  const handleSelectDocument = useCallback(async (docId: string) => {
    try {
      const meta = await getDocumentMeta(docId);
      if (!meta) return;

      const chunkIdx = meta.activeChunkIndex || 0;
      const chunk = await getDocumentChunk(docId, chunkIdx);
      if (chunk) {
        setDocumentMeta(meta);
        setActiveChunkIndex(chunkIdx);
        setActiveChunk(chunk);
        setSelectedSentenceId(null);
        setAnalysisData(null);
      }
    } catch (e) {
      console.warn("Could not switch document:", e);
    }
  }, []);

  // Xóa tài liệu khỏi IndexedDB
  const handleDeleteDocument = useCallback(
    async (docId: string) => {
      try {
        await deleteDocument(docId);
        const remaining = await getAllDocumentsMeta();
        setAllSavedDocs(remaining);
        if (documentMeta?.id === docId) {
          if (remaining.length > 0) {
            handleSelectDocument(remaining[0].id);
          } else {
            setDocumentMeta(null);
            setActiveChunk(null);
          }
        }
      } catch (e) {
        console.warn("Could not delete document:", e);
      }
    },
    [documentMeta, handleSelectDocument]
  );

  // Lưu phiên học hiện tại vào IndexedDB (.vdoc)
  const handleSaveSession = useCallback(async () => {
    if (!documentMeta) return;
    setIsSavingSession(true);
    try {
      const allChunks = await getAllDocumentChunks(documentMeta.id);
      const vdoc = buildVdocPackage({
        meta: documentMeta,
        chunks: allChunks.length > 0 ? allChunks : activeChunk ? [activeChunk] : [],
        activeChunkIndex,
        lastReadSentenceId: activeSentence?.id,
      });
      await saveVdocPackage(vdoc);
      setSaveSuccessMessage("Đã lưu vào IndexedDB!");
      setTimeout(() => setSaveSuccessMessage(null), 2500);

      // Cập nhật danh sách tài liệu
      const docs = await getAllDocumentsMeta();
      setAllSavedDocs(docs);
    } catch (err) {
      console.warn("Could not save session into IndexedDB:", err);
    } finally {
      setIsSavingSession(false);
    }
  }, [documentMeta, activeChunk, activeChunkIndex, activeSentence]);

  // Lưu từ vựng vào Deck của Vocabloom qua API /api/translate/add
  const handleSaveWordToDeck = async (
    term: string,
    translation: string,
    phonetic: string
  ) => {
    try {
      const res = await fetch("/api/translate/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: {
            type: "new",
            title: `Smart Reader: ${documentMeta?.title || "Tài liệu"}`,
            description: "Từ vựng được lưu từ bài đọc AI",
            level: "B2",
          },
          word: {
            term,
            translation,
            phonetic,
            exampleSentence: activeSentence?.text || "",
            exampleTranslation: analysisData?.translationVi || "",
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn("Could not save to server deck (may not be logged in)", err);
      }
    } catch (e) {
      console.warn("Save word offline fallback", e);
    }
  };

  const handleImportStructuredComplete = (
    meta: StructuredDocumentMeta,
    chunks: DocumentChunk[]
  ) => {
    setDocumentMeta(meta);
    setActiveChunkIndex(0);
    setActiveChunk(chunks[0] || null);
    setSelectedSentenceId(null);
    setAnalysisData(null);
    setIsImporting(false);

    // Cập nhật lại danh sách thư viện
    getAllDocumentsMeta().then((list) => setAllSavedDocs(list));
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-1.5rem)] max-w-[1600px] flex-col px-3 py-3 md:px-5 md:py-3">
      {/* Tối ưu Header: Hợp nhất Header và thanh ChunkPaginationBar thành 1 thanh header duy nhất (~52-56px) */}
      <header className="mb-2.5 flex h-14 shrink-0 items-center justify-between gap-2.5 rounded-2xl border-2 border-b-4 border-[#e5e5e5] bg-white px-3 md:px-4 shadow-xs">
        {/* Bên trái: Nút Back, Nút Mục lục TOC (kèm badge số chương), Tên tài liệu, Badge số trang/phần */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <Link
            href="/"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#e5e5e5] text-ash hover:bg-gray-100 hover:text-charcoal transition-colors"
            title="Quay về trang chủ"
          >
            <ArrowLeft className="size-4" />
          </Link>

          {/* Nút mở Mục lục TOC */}
          <button
            type="button"
            onClick={() => setIsTocOpen(true)}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#e5e5e5] px-2 text-xs font-bold text-eel-dark-blue hover:bg-[#e5f6fd] hover:text-[#1cb0f6] transition-colors"
            title="Mục lục & Thư viện tài liệu"
          >
            <Menu className="size-4 text-[#1cb0f6]" />
            <span className="hidden sm:inline">Mục lục</span>
            {documentMeta?.toc && documentMeta.toc.length > 0 && (
              <span className="rounded-full bg-[#e5f6fd] px-1.5 py-0.2 text-[10px] font-black text-[#087db4]">
                {documentMeta.toc.length}
              </span>
            )}
          </button>

          {/* Tên tài liệu */}
          <h1
            className="text-xs sm:text-sm md:text-[15px] font-black text-eel-dark-blue truncate max-w-[130px] sm:max-w-[200px] md:max-w-xs"
            title={documentMeta?.title || "Tài liệu"}
          >
            {documentMeta?.title || "Đang tải tài liệu..."}
          </h1>

          {/* Badge số trang / phần */}
          {documentMeta && (
            <Badge
              variant="blue"
              className="hidden xl:inline-flex text-[10px] py-0 px-2 min-h-6 shrink-0"
            >
              {documentMeta.totalPages} trang · {documentMeta.totalChunks} phần
            </Badge>
          )}
        </div>

        {/* Ở giữa: Bộ điều hướng Chunk phân trang gọn gàng [ < ] Phần X/Y (Trang A-B) [ > ] */}
        <div className="flex items-center justify-center shrink-0">
          <ChunkPaginationBar
            meta={documentMeta}
            activeChunkIndex={activeChunkIndex}
            currentChapterTitle={activeChunk?.chapterTitle}
            startPage={activeChunk?.startPage || 1}
            endPage={activeChunk?.endPage || 1}
            onPrevChunk={() => handleSelectChunk(activeChunkIndex - 1)}
            onNextChunk={() => handleSelectChunk(activeChunkIndex + 1)}
            onSelectChunkIndex={handleSelectChunk}
          />
        </div>

        {/* Bên phải: Nút "Lưu phiên học", "Nhập tài liệu", "Local AI Config", và nút bật/tắt Zen Mode */}
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          <Button
            variant={saveSuccessMessage ? "default" : "secondary"}
            size="sm"
            onClick={handleSaveSession}
            disabled={isSavingSession || !documentMeta}
            className={`h-8 px-2.5 text-xs font-bold transition-all ${
              saveSuccessMessage
                ? "border-[#46a302] bg-ecto-green text-white hover:bg-[#51bd02]"
                : "border-[#e5e5e5] text-charcoal hover:bg-gray-100"
            }`}
            title="Lưu phiên học và tiến độ vào IndexedDB (.vdoc)"
          >
            {isSavingSession ? (
              <Loader2 className="size-3.5 animate-spin text-[#1cb0f6]" />
            ) : saveSuccessMessage ? (
              <Check className="size-3.5 text-white" />
            ) : (
              <Save className="size-3.5 text-ecto-green" />
            )}
            <span className="hidden xl:inline">
              {saveSuccessMessage ? "Đã lưu" : "Lưu phiên"}
            </span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsImporting(true)}
            className="h-8 px-2.5 text-xs font-bold border-[#e5e5e5] text-charcoal hover:bg-gray-100"
            title="Nhập tài liệu (Text, PDF, Word, Ảnh)"
          >
            <FilePlus2 className="size-3.5 text-[#1cb0f6]" />
            <span className="hidden lg:inline">Nhập tài liệu</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsConfigOpen(true)}
            className="h-8 px-2.5 text-xs font-bold border-[#e5e5e5] text-charcoal hover:bg-gray-100"
            title="Cài đặt Local AI Endpoint"
          >
            <Settings2 className="size-3.5 text-[#1cb0f6]" />
            <span className="hidden xl:inline font-mono text-[11px] text-charcoal">
              {aiConfig.model}
            </span>
          </Button>

          {/* Nút bật / tắt Zen Mode */}
          <Button
            variant={isZenMode ? "blue" : "secondary"}
            size="sm"
            onClick={() => setIsZenMode((prev) => !prev)}
            className={`h-8 px-2.5 text-xs font-bold transition-all ${
              isZenMode
                ? "border-macaw-blue bg-macaw-blue text-white hover:bg-[#16a5e8]"
                : "border-[#e5e5e5] text-charcoal hover:bg-gray-100"
            }`}
            title={
              isZenMode
                ? "Thoát chế độ Zen (Mở lại cột phân tích)"
                : "Bật chế độ Zen (Thu gọn cột phân tích để tập trung đọc)"
            }
          >
            {isZenMode ? (
              <PanelRightOpen className="size-3.5" />
            ) : (
              <PanelRightClose className="size-3.5" />
            )}
            <span className="hidden sm:inline">
              {isZenMode ? "Thoát Zen" : "Zen Mode"}
            </span>
          </Button>
        </div>
      </header>

      {/* Main Content Area (Layout Responsive & Zen Mode) */}
      <main className="flex-1 overflow-hidden">
        {isZenMode ? (
          /* Khi Zen Mode (thu gọn cột phân tích): Cột văn bản tự động căn giữa với độ rộng tối ưu (max-w-4xl) */
          <div className="mx-auto h-full max-w-4xl transition-all duration-200">
            <InteractiveReader
              paragraphs={parsedData.paragraphs}
              activeSentenceId={activeSentence?.id || null}
              onSelectSentence={handleAnalyzeSentence}
              onSaveWordToDeck={handleSaveWordToDeck}
              contextVocabMap={contextVocabMap}
              aiPhrases={analysisData?.idiomsAndPhrases}
            />
          </div>
        ) : (
          /* Khi cột phân tích mở: Tỉ lệ chia cột hài hòa (cột văn bản 7-8 phần, cột phân tích 5-4 phần) */
          <div className="grid h-full grid-cols-1 gap-3.5 overflow-hidden lg:grid-cols-12 transition-all duration-200">
            {/* Cột trái: Văn bản đọc */}
            <section className="flex flex-col h-full lg:col-span-7 xl:col-span-8 overflow-hidden">
              <InteractiveReader
                paragraphs={parsedData.paragraphs}
                activeSentenceId={activeSentence?.id || null}
                onSelectSentence={handleAnalyzeSentence}
                onSaveWordToDeck={handleSaveWordToDeck}
                contextVocabMap={contextVocabMap}
                aiPhrases={analysisData?.idiomsAndPhrases}
              />
            </section>

            {/* Cột phải: Bóc tách câu chi tiết bằng Local AI */}
            <section className="flex flex-col h-full lg:col-span-5 xl:col-span-4 overflow-hidden">
              <SentenceBreakdownCard
                data={analysisData}
                isLoading={isAnalyzing}
                error={analysisError}
                selectedSentenceText={activeSentence?.text || null}
                onRetry={() => activeSentence && handleAnalyzeSentence(activeSentence)}
                onOpenAIConfig={() => setIsConfigOpen(true)}
                onSaveWordToDeck={handleSaveWordToDeck}
                onClosePanel={() => setIsZenMode(true)}
              />
            </section>
          </div>
        )}
      </main>

      {/* Sidebar Mục lục TOC & Thư viện tài liệu */}
      <DocumentTocSidebar
        isOpen={isTocOpen}
        onClose={() => setIsTocOpen(false)}
        documentMeta={documentMeta}
        allSavedDocs={allSavedDocs}
        activeChunkIndex={activeChunkIndex}
        onSelectTocItem={handleSelectTocItem}
        onSelectDocument={handleSelectDocument}
        onDeleteDocument={handleDeleteDocument}
        onNewDocument={() => setIsImporting(true)}
        onSaveCurrentSession={handleSaveSession}
      />

      {/* Modal Cài đặt Local AI */}
      <AIConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onConfigUpdated={(cfg) => setAiConfig(cfg)}
      />

      {/* Modal Nhập Tài liệu (Text, PDF, Word, Ảnh OCR) */}
      {isImporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-2xl">
            <DocumentImporter
              onImportStructuredComplete={handleImportStructuredComplete}
              onCancel={() => setIsImporting(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
