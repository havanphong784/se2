"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Settings2,
  FilePlus2,
  Menu,
  Save,
  Check,
  Loader2,
  Maximize2,
  Minimize2,
  Expand,
  Shrink,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth-provider";
import { InteractiveReader } from "@/components/reading/interactive-reader";
import { SentenceBreakdownCard } from "@/components/reading/sentence-breakdown-card";
import { DocumentImporter } from "@/components/reading/document-importer";
import { AIConfigModal } from "@/components/reading/ai-config-modal";
import { DocumentTocSidebar } from "@/components/reading/document-toc-sidebar";
import { ChunkPaginationBar } from "@/components/reading/chunk-pagination-bar";
import { ReaderTooltip } from "@/components/reading/reader-tooltip";
import { segmentText } from "@/lib/reading/text-segmenter";
import { prefetchDocumentWords, seedOfflineLexicon } from "@/lib/reading/dictionary-cache";
import { detectPhrasesInSentence } from "@/lib/reading/phrase-matcher";
import { extractStructuredText } from "@/lib/reading/extractors";
import { buildSlidingWindowContext } from "@/lib/reading/context-window";
import { SpeculativePrefetchQueue } from "@/lib/reading/prefetch-queue";
import { SemanticRepairQueue } from "@/lib/reading/repair-queue";
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
  saveSentenceAnalysis,
  getSentenceAnalysis,
  getAllAnalysesForDocument,
  deleteAnalysesByDocument,
} from "@/lib/reading/indexed-storage";
import {
  getSavedAIConfig,
  analyzeParagraph,
  analyzeSentence,
  getCachedAnalysis,
  setCachedAnalysis,
  fetchFastSentenceTranslation,
  createInstantSentenceDraft,
  primeSentenceAnalysisCache,
  hasCachedAnalysis,
  clearSentenceAnalysisCache,
  isCompleteSentenceAnalysis,
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
  const { authFetch } = useAuth();
  const [documentMeta, setDocumentMeta] = useState<StructuredDocumentMeta | null>(null);
  const [activeChunk, setActiveChunk] = useState<DocumentChunk | null>(null);
  const [activeChunkIndex, setActiveChunkIndex] = useState<number>(0);
  const [allSavedDocs, setAllSavedDocs] = useState<StructuredDocumentMeta[]>([]);

  const [isImporting, setIsImporting] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [aiConfig, setAiConfig] = useState<ClientAIConfig>(() => getSavedAIConfig());
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [isDocumentSaved, setIsDocumentSaved] = useState<boolean>(true);
  const [analyzedSentencesCount, setAnalyzedSentencesCount] = useState<number>(0);

  // Khởi tạo Speculative Prefetch Queue đón đầu câu N+1, N+2
  const [prefetchQueue] = useState(
    () =>
      new SpeculativePrefetchQueue({
        debounceMs: 1200,
        maxLookahead: 2,
        onSentencePrefetched: () => {
          setAnalyzedSentencesCount((prev) => prev + 1);
        },
      })
  );

  // Khởi tạo Semantic Repair Queue tự động sửa lỗi typographic giáo trình ở background
  const [repairQueue] = useState(
    () =>
      new SemanticRepairQueue({
        delayMs: 500,
        onChunkRepaired: (chunkIndex, repairedText) => {
          setActiveChunk((current) => {
            if (!current || current.chunkIndex !== chunkIndex) return current;
            return {
              ...current,
              repairedRawText: repairedText,
              repairStatus: "completed",
            };
          });
        },
      })
  );

  // Tải tài liệu đã lưu từ IndexedDB và nạp Offline Lexicon khi khởi động
  useEffect(() => {
    seedOfflineLexicon();
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
            setIsDocumentSaved(true);
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
          setIsDocumentSaved(true);
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

  // Nạp trước (preload) toàn bộ kết quả phân tích câu đã lưu vào L1 RAM cache khi tải/đổi tài liệu
  useEffect(() => {
    const docId = documentMeta?.id;
    if (!docId) return;

    let isSubscribed = true;
    getAllAnalysesForDocument(docId)
      .then((analyses) => {
        if (!isSubscribed) return;
        primeSentenceAnalysisCache(analyses);
        setAnalyzedSentencesCount(Object.keys(analyses).length);
      })
      .catch((err) => {
        console.warn("Could not preload sentence analyses:", err);
      });

    return () => {
      isSubscribed = false;
    };
  }, [documentMeta?.id]);

  // Khởi động Semantic Repair Queue tự động sửa layout giáo trình ở background khi mở tài liệu
  const activeChunkIndexRef = useRef(activeChunkIndex);
  useEffect(() => {
    activeChunkIndexRef.current = activeChunkIndex;
  }, [activeChunkIndex]);

  useEffect(() => {
    const docId = documentMeta?.id;
    if (!docId) return;

    let mounted = true;
    getAllDocumentChunks(docId)
      .then((chunks) => {
        if (!mounted || !chunks || chunks.length === 0) return;
        repairQueue.start(docId, chunks, activeChunkIndexRef.current, aiConfig);
      })
      .catch((err) => {
        console.warn("SemanticRepairQueue init failed:", err);
      });

    return () => {
      mounted = false;
      repairQueue.cancel();
    };
  }, [documentMeta?.id, aiConfig, repairQueue]);

  // Cập nhật ưu tiên sửa chunk khi người dùng chuyển sang chunk khác
  useEffect(() => {
    repairQueue.reprioritize(activeChunkIndex);
  }, [activeChunkIndex, repairQueue]);

  // Nội dung raw của Chunk hiện tại (ưu tiên repairedRawText sau khi AI sửa layout)
  const rawContent = useMemo(() => {
    return activeChunk?.repairedRawText || activeChunk?.rawText || SAMPLE_TEXT;
  }, [activeChunk]);

  // Phân đoạn văn bản của Chunk hiện tại
  const parsedData = useMemo(() => segmentText(rawContent), [rawContent]);

  // Lưu ID và văn bản của câu đang chọn để bảo toàn focus khi AI sửa layout
  const [selectedSentenceId, setSelectedSentenceId] = useState<string | null>(null);
  const lastSelectedSentenceTextRef = useRef<string | null>(null);

  // Derive activeSentence từ parsedData và selectedSentenceId
  const activeSentence = useMemo(() => {
    const allSentences = parsedData.paragraphs.flatMap((p) => p.sentences);
    if (allSentences.length === 0) return null;
    if (!selectedSentenceId) return allSentences[0];
    return allSentences.find((s) => s.id === selectedSentenceId) || allSentences[0];
  }, [parsedData, selectedSentenceId]);

  // Lưu lại text của activeSentence mỗi khi người dùng chọn câu mới
  useEffect(() => {
    if (activeSentence?.text) {
      lastSelectedSentenceTextRef.current = activeSentence.text;
    }
  }, [activeSentence?.text]);

  // Khi văn bản chunk được sửa layout mượt mà, bảo toàn vị trí câu đang đọc
  useEffect(() => {
    const targetText = lastSelectedSentenceTextRef.current;
    if (!targetText) return;

    const allSentences = parsedData.paragraphs.flatMap((p) => p.sentences);
    if (allSentences.length === 0) return;

    // 1. Nếu ID cũ vẫn khớp chính xác
    const currentById = allSentences.find((s) => s.id === selectedSentenceId);
    if (currentById && currentById.text === targetText) return;

    // 2. Tìm câu có nội dung trùng khớp hoặc bao hàm câu cũ để giữ vững focus
    const norm = (str: string) => str.toLowerCase().replace(/\s+/g, " ").trim();
    const targetNorm = norm(targetText);

    const exactMatch = allSentences.find((s) => norm(s.text) === targetNorm);
    if (exactMatch) {
      setSelectedSentenceId(exactMatch.id);
      return;
    }

    const partialMatch = allSentences.find((s) => {
      const sNorm = norm(s.text);
      return (
        sNorm.length > 15 &&
        targetNorm.length > 15 &&
        (sNorm.includes(targetNorm) || targetNorm.includes(sNorm))
      );
    });

    if (partialMatch) {
      setSelectedSentenceId(partialMatch.id);
    }
  }, [parsedData, selectedSentenceId]);

  // Kết quả phân tích và trạng thái
  const [analysisData, setAnalysisData] = useState<SentenceBreakdownResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
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

  // Phân tích câu đang chọn với cơ chế Instant-First Progressive Loading
  const handleAnalyzeSentence = useCallback(
    async (sentence: SentenceItem) => {
      setSelectedSentenceId(sentence.id);
      setAnalysisError(null);

      // 1. Kiểm tra cache đã có kết quả hoàn chỉnh chưa (L1 RAM -> L2 LocalStorage -> IndexedDB)
      let cached = getCachedAnalysis(sentence.text);
      if (!isCompleteSentenceAnalysis(cached) && documentMeta?.id) {
        try {
          const idbCached = await getSentenceAnalysis(documentMeta.id, sentence.text);
          if (isCompleteSentenceAnalysis(idbCached)) {
            setCachedAnalysis(sentence.text, idbCached!);
            cached = idbCached;
          }
        } catch {}
      }

      if (isCompleteSentenceAnalysis(cached)) {
        setAnalysisData(cached!);
        setIsAnalyzing(false);
        setIsEnriching(false);
        if (cached!.vocabulary && cached!.vocabulary.length > 0) {
          setContextVocabMap((prev) => {
            const next = { ...prev };
            cached!.vocabulary.forEach((v) => {
              next[v.term.toLowerCase()] = { meaning: v.contextMeaningVi, ipa: v.ipa };
            });
            return next;
          });
        }
        return;
      }

      // 2. Instant Draft (~100ms): Hiển thị bản nháp tức thì để người dùng đọc hiểu ngay không phải chờ
      const instantDraft = createInstantSentenceDraft(sentence.text, cached?.translationVi || "");
      setAnalysisData(instantDraft);
      setIsAnalyzing(false);
      setIsEnriching(true);

      // Nếu chưa có translationVi trong draft, lấy nhanh từ fast translation (< 150ms)
      if (!instantDraft.translationVi) {
        fetchFastSentenceTranslation(sentence.text).then((quickTrans) => {
          if (quickTrans) {
            setAnalysisData((current) => {
              if (!current || current.sentence !== sentence.text) return current;
              return {
                ...current,
                translationVi: current.translationVi || quickTrans,
              };
            });
          }
        });
      }

      // 3. Chạy AI phân tích chuyên sâu (ngữ pháp, mệnh đề S-V-O, từ vựng) ở background
      try {
        const allSentences = parsedData.paragraphs.flatMap((p) => p.sentences);
        const currentIndex = allSentences.findIndex((s) => s.id === sentence.id);
        const detected = detectPhrasesInSentence(sentence.text, sentence.tokens);
        const slidingContext = buildSlidingWindowContext(
          allSentences,
          currentIndex !== -1 ? currentIndex : 0,
          detected.phrases
        );

        const fullResult = await analyzeSentence(
          sentence.text,
          slidingContext,
          aiConfig,
          detected.phrases
        );
        setAnalysisData((current) => {
          if (!current || current.sentence === sentence.text) {
            return fullResult;
          }
          return current;
        });

        // Tự động lưu vào IndexedDB theo tài liệu và tăng số câu đã phân tích
        if (documentMeta?.id) {
          saveSentenceAnalysis(documentMeta.id, sentence.text, fullResult).catch((err) => {
            console.warn("Could not save sentence analysis to IndexedDB:", err);
          });
          setAnalyzedSentencesCount((prev) => prev + 1);
        }

        if (fullResult.vocabulary && fullResult.vocabulary.length > 0) {
          setContextVocabMap((prev) => {
            const next = { ...prev };
            fullResult.vocabulary.forEach((v) => {
              next[v.term.toLowerCase()] = { meaning: v.contextMeaningVi, ipa: v.ipa };
            });
            return next;
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setAnalysisError(msg);
      } finally {
        setIsEnriching(false);
      }
    },
    [aiConfig, parsedData, documentMeta]
  );

  // Tự động phân tích câu đầu tiên khi mở bài đọc hoặc đổi chunk nếu chưa có câu nào được chọn
  useEffect(() => {
    const allSentences = parsedData.paragraphs.flatMap((p) => p.sentences);
    if (allSentences.length > 0 && !selectedSentenceId) {
      const firstSentence = allSentences[0];
      const timer = setTimeout(() => {
        handleAnalyzeSentence(firstSentence);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [parsedData, selectedSentenceId, handleAnalyzeSentence]);

  // Speculative Prefetching Queue: Tự động phân tích đón đầu các câu N+1, N+2 khi người dùng đọc câu N
  useEffect(() => {
    if (!activeSentence?.id || !parsedData) return;

    const allSentences = parsedData.paragraphs.flatMap((p) => p.sentences);
    const currentIndex = allSentences.findIndex((s) => s.id === activeSentence.id);
    if (currentIndex === -1) return;

    prefetchQueue.enqueue(
      allSentences,
      currentIndex,
      aiConfig,
      documentMeta?.id
    );

    return () => {
      prefetchQueue.cancel();
    };
  }, [activeSentence?.id, parsedData, aiConfig, documentMeta?.id, prefetchQueue]);

  // Tính toán số câu và phần trăm tiến độ đọc của Chunk hiện tại
  const allChunkSentences = useMemo(
    () => parsedData.paragraphs.flatMap((p) => p.sentences),
    [parsedData]
  );

  // Tính toán tiến độ AI của Chunk hiện tại
  const chunkAnalyzedCount = useMemo(() => {
    return allChunkSentences.filter((s) => hasCachedAnalysis(s.text)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allChunkSentences, analyzedSentencesCount]);

  const chunkAnalyzedPercent = useMemo(() => {
    if (allChunkSentences.length === 0) return 0;
    return Math.round((chunkAnalyzedCount / allChunkSentences.length) * 100);
  }, [chunkAnalyzedCount, allChunkSentences.length]);

  // Hàng đợi Phân tích toàn bộ Chunk (Pre-analyze Chunk Queue)
  const [isPreanalyzingChunk, setIsPreanalyzingChunk] = useState(false);
  const [preanalyzeProgress, setPreanalyzeProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const abortPreanalyzeRef = useRef<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleStartPreanalyzeChunk = useCallback(async () => {
    if (isPreanalyzingChunk || !documentMeta?.id) return;

    // Lấy danh sách các câu trong allChunkSentences chưa có cache
    const unanalyzedSentences = allChunkSentences.filter((s) => !hasCachedAnalysis(s.text));
    if (unanalyzedSentences.length === 0) {
      showToast("Phần này đã được AI phân tích 100%!");
      return;
    }

    setIsPreanalyzingChunk(true);
    abortPreanalyzeRef.current = false;
    setPreanalyzeProgress({ current: 0, total: unanalyzedSentences.length });

    // Gom các câu unanalyzed thành các batch tối đa 3-4 câu (ưu tiên các câu cùng paragraph)
    const MAX_BATCH_SIZE = 4;
    const batches: SentenceItem[][] = [];
    let currentBatch: SentenceItem[] = [];

    for (const paragraph of parsedData.paragraphs) {
      const unanalyzedInPara = paragraph.sentences.filter((s) => !hasCachedAnalysis(s.text));
      if (unanalyzedInPara.length === 0) continue;

      if (currentBatch.length > 0 && currentBatch.length + unanalyzedInPara.length <= MAX_BATCH_SIZE) {
        currentBatch.push(...unanalyzedInPara);
      } else {
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
          currentBatch = [];
        }
        for (let i = 0; i < unanalyzedInPara.length; i += MAX_BATCH_SIZE) {
          const slice = unanalyzedInPara.slice(i, i + MAX_BATCH_SIZE);
          if (slice.length < MAX_BATCH_SIZE && i + MAX_BATCH_SIZE >= unanalyzedInPara.length) {
            currentBatch = slice;
          } else {
            batches.push(slice);
          }
        }
      }
    }
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    if (batches.length === 0 && unanalyzedSentences.length > 0) {
      for (let i = 0; i < unanalyzedSentences.length; i += MAX_BATCH_SIZE) {
        batches.push(unanalyzedSentences.slice(i, i + MAX_BATCH_SIZE));
      }
    }

    let processedCount = 0;
    const totalCount = unanalyzedSentences.length;

    for (let bIndex = 0; bIndex < batches.length; bIndex++) {
      if (abortPreanalyzeRef.current) break;

      const batch = batches[bIndex];
      const toAnalyze = batch.filter((s) => !hasCachedAnalysis(s.text));

      if (toAnalyze.length === 0) {
        processedCount += batch.length;
        setPreanalyzeProgress({
          current: Math.min(processedCount, totalCount),
          total: totalCount,
        });
        continue;
      }

      try {
        const batchParam = toAnalyze.map((s) => ({
          id: s.id,
          text: s.text,
          tokens: s.tokens,
        }));
        const resultMap = await analyzeParagraph(batchParam, aiConfig);
        if (abortPreanalyzeRef.current) break;

        let batchSuccessCount = 0;
        for (const s of toAnalyze) {
          const res = resultMap[s.text] || getCachedAnalysis(s.text);
          if (res && isCompleteSentenceAnalysis(res)) {
            if (documentMeta?.id) {
              await saveSentenceAnalysis(documentMeta.id, s.text, res);
              batchSuccessCount++;
            }

            if (activeSentence?.id === s.id) {
              setAnalysisData(res);
            }
          }
        }

        if (batchSuccessCount > 0) {
          setAnalyzedSentencesCount((prev) => prev + batchSuccessCount);
        }
      } catch (err) {
        console.warn("Preanalyze batch failed:", err);
      }

      processedCount += batch.length;
      setPreanalyzeProgress({
        current: Math.min(processedCount, totalCount),
        total: totalCount,
      });

      if (abortPreanalyzeRef.current) break;

      // Delay ~150ms giữa các batch để không làm nghẽn local AI
      if (bIndex < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }

    setIsPreanalyzingChunk(false);
  }, [
    isPreanalyzingChunk,
    documentMeta,
    allChunkSentences,
    parsedData,
    aiConfig,
    activeSentence,
    showToast,
  ]);

  const handleStopPreanalyzeChunk = useCallback(() => {
    abortPreanalyzeRef.current = true;
    setIsPreanalyzingChunk(false);
    showToast("Đã dừng phân tích trước.");
  }, [showToast]);

  // Tự động dừng pre-analyze khi đổi chunk hoặc đổi tài liệu
  useEffect(() => {
    return () => {
      abortPreanalyzeRef.current = true;
    };
  }, [activeChunkIndex, documentMeta?.id]);

  // Xóa toàn bộ cache phân tích AI của tài liệu để phân tích lại từ đầu
  const handleClearDocumentAnalyses = useCallback(async () => {
    if (!documentMeta?.id) return;
    abortPreanalyzeRef.current = true;
    setIsPreanalyzingChunk(false);

    try {
      await deleteAnalysesByDocument(documentMeta.id);
      clearSentenceAnalysisCache();
      setAnalyzedSentencesCount(0);
      setAnalysisData(null);
      showToast("Đã xóa sạch cache phân tích AI của tài liệu!");
    } catch (err) {
      console.warn("Could not clear document analyses:", err);
      showToast("Không thể xóa cache phân tích!");
    }
  }, [documentMeta, showToast]);

  const currentSentenceIdx = useMemo(() => {
    if (!activeSentence?.id) return 0;
    const idx = allChunkSentences.findIndex((s) => s.id === activeSentence.id);
    return idx >= 0 ? idx : 0;
  }, [allChunkSentences, activeSentence]);

  const readingProgressPercent = useMemo(() => {
    if (allChunkSentences.length === 0) return 0;
    return Math.min(
      100,
      Math.round(((currentSentenceIdx + 1) / allChunkSentences.length) * 100)
    );
  }, [allChunkSentences, currentSentenceIdx]);

  // Bật/tắt Fullscreen của trình duyệt
  const toggleNativeFullscreen = useCallback(() => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Phím tắt bàn phím: F để bật/tắt Focus Mode, Esc để thoát Focus Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "f" || e.key === "F") {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setIsFocusMode((prev) => !prev);
        }
      } else if (e.key === "Escape" && isFocusMode) {
        e.preventDefault();
        setIsFocusMode(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFocusMode]);

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
        setIsDocumentSaved(true);
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
      const [allChunks, analyses] = await Promise.all([
        getAllDocumentChunks(documentMeta.id),
        getAllAnalysesForDocument(documentMeta.id),
      ]);
      const vdoc = buildVdocPackage({
        meta: documentMeta,
        chunks: allChunks.length > 0 ? allChunks : activeChunk ? [activeChunk] : [],
        activeChunkIndex,
        lastReadSentenceId: activeSentence?.id,
        aiAnalysesCache: analyses,
      });
      await saveVdocPackage(vdoc);
      setIsDocumentSaved(true);
      showToast("Đã lưu phiên học vào IndexedDB!");

      // Cập nhật danh sách tài liệu
      const docs = await getAllDocumentsMeta();
      setAllSavedDocs(docs);
    } catch (err) {
      console.warn("Could not save session into IndexedDB:", err);
    } finally {
      setIsSavingSession(false);
    }
  }, [documentMeta, activeChunk, activeChunkIndex, activeSentence, showToast]);

  // Lưu từ vựng vào Deck của Vocabloom qua API /api/translate/add
  const handleSaveWordToDeck = async (
    term: string,
    translation: string,
    phonetic: string
  ) => {
    try {
      const res = await authFetch("/api/translate/add", {
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
    setIsDocumentSaved(true);

    // Cập nhật lại danh sách thư viện
    getAllDocumentsMeta().then((list) => setAllSavedDocs(list));
  };

  // Huy hiệu hiển thị trực quan tiến độ sẵn sàng AI của Chunk hiện tại
  const renderAiReadinessBadge = () => {
    if (allChunkSentences.length === 0) return null;

    if (isPreanalyzingChunk) {
      return (
        <ReaderTooltip
          title={`Đang phân tích trước: ${preanalyzeProgress.current}/${preanalyzeProgress.total} câu`}
          description="AI đang tự động phân tích cấu trúc các câu tiếp theo trong nền để đọc mượt mà 0ms."
          badge="Đang chạy"
          badgeVariant="blue"
        >
          <div className="flex h-8 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2 text-xs font-bold text-amber-800 animate-pulse shrink-0">
            <Loader2 className="size-3.5 animate-spin text-amber-600 shrink-0" />
            <span className="text-[11px] font-black">
              {Math.round((preanalyzeProgress.current / Math.max(1, preanalyzeProgress.total)) * 100)}%
            </span>
            <button
              type="button"
              onClick={handleStopPreanalyzeChunk}
              className="ml-0.5 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-black text-amber-900 hover:bg-amber-300 transition-colors cursor-pointer"
              title="Dừng phân tích trước"
            >
              Dừng
            </button>
          </div>
        </ReaderTooltip>
      );
    }

    if (chunkAnalyzedPercent === 100) {
      return (
        <ReaderTooltip
          title="Sẵn sàng đọc offline 100%"
          description="Tất cả câu trong phần này đã được AI phân tích và lưu vào IndexedDB (.vdoc). Sẵn sàng đọc offline 0ms."
          badge="Offline 100%"
          badgeVariant="green"
        >
          <div className="flex h-8 items-center gap-1 rounded-lg border border-eel-light bg-[#f7fff1] px-2 text-xs font-black text-[#438f0e] shrink-0 cursor-default shadow-2xs">
            <Zap className="size-3.5 fill-[#438f0e] text-[#438f0e]" />
            <span className="text-[11px] font-black">100%</span>
          </div>
        </ReaderTooltip>
      );
    }

    return (
      <ReaderTooltip
        title={`Tiến độ AI: ${chunkAnalyzedCount}/${allChunkSentences.length} câu (${chunkAnalyzedPercent}%)`}
        description={`Đã phân tích và lưu trữ ${chunkAnalyzedCount} câu trong phần này. Bấm để AI tự động phân tích trước các câu còn lại giúp chuyển câu tức thì 0ms.`}
        badge={chunkAnalyzedCount > 0 ? "Bấm để tải trước" : "Chưa tải trước"}
        badgeVariant="blue"
      >
        <button
          type="button"
          onClick={handleStartPreanalyzeChunk}
          aria-label="Phân tích trước bằng AI"
          className="group flex h-8 items-center gap-1 rounded-lg border border-[#bfe9fd] bg-[#f3fbff] px-2 text-xs font-black text-[#087db4] hover:bg-[#e0f2fe] hover:border-[#7dd3fc] transition-all cursor-pointer shrink-0 shadow-2xs"
        >
          <Zap className="size-3.5 text-[#1cb0f6] group-hover:scale-110 transition-transform" />
          <span className="text-[11px] font-black">
            {chunkAnalyzedPercent}%
          </span>
        </button>
      </ReaderTooltip>
    );
  };

  return (
    <div
      className={cn(
        "transition-all duration-200",
        isFocusMode
          ? "fixed inset-0 z-50 flex h-screen w-screen flex-col bg-[#f8fafc] overflow-hidden p-2.5 sm:p-3 md:p-3.5"
          : "mx-auto flex h-[calc(100vh-1.5rem)] max-w-[1600px] flex-col px-3 py-3 md:px-5 md:py-3"
      )}
    >
      {/* Dải tiến độ đọc viền mảnh (Thin Reading Progress Bar) chạy dọc mép trên cùng khi Focus Mode */}
      {isFocusMode && (
        <div className="fixed top-0 inset-x-0 h-1 bg-[#e5e5e5] z-50">
          <div
            className="h-full bg-ecto-green transition-all duration-300"
            style={{ width: `${readingProgressPercent}%` }}
          />
        </div>
      )}

      {/* Header bar: Hiển thị thanh rút gọn (Floating Focus Topbar) khi ở Focus Mode, hoặc Header đầy đủ khi ở Normal Mode */}
      {isFocusMode ? (
        <header className="mb-2 flex h-12 shrink-0 items-center justify-between gap-2.5 rounded-2xl border-2 border-b-3 border-[#e5e5e5] bg-white px-3 md:px-4 shadow-xs">
          {/* Bên trái: Tên tài liệu & Tiến độ câu */}
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#e5f6fd] text-[#1cb0f6]">
              <Sparkles className="size-3.5" />
            </span>
            <h1
              className="text-xs sm:text-sm font-black text-eel-dark-blue truncate min-w-0"
              title={documentMeta?.title || "Tài liệu"}
            >
              {documentMeta?.title || "Tài liệu"}
            </h1>
            {allChunkSentences.length > 0 && (
              <Badge variant="neutral" className="hidden sm:inline-flex text-[10.5px] py-0 px-2 min-h-5 shrink-0">
                Câu {currentSentenceIdx + 1}/{allChunkSentences.length}
              </Badge>
            )}
          </div>

          {/* Ở giữa: Bộ điều hướng Chunk phân trang & Huy hiệu AI Readiness */}
          <div className="flex items-center justify-center gap-2 shrink-0">
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
            {renderAiReadinessBadge()}
            {activeChunk?.repairedRawText && (
              <ReaderTooltip
                title="Bố cục đã tối ưu bằng AI"
                description="Bố cục văn bản của phần này đã được Semantic Repair AI sửa lỗi rách chữ (kerning), nối từ gãy dòng và chuẩn hóa đề mục/bảng biểu."
                badge="Layout Clean"
                badgeVariant="amber"
              >
                <div
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-amber-300 bg-[#fefce8] text-amber-800 shadow-2xs cursor-default"
                  aria-label="Bố cục đã tối ưu bằng AI"
                >
                  <Zap className="size-4 fill-amber-500 text-amber-500" />
                </div>
              </ReaderTooltip>
            )}
          </div>

          {/* Bên phải: Nút Fullscreen native & Nút Thoát Focus Mode */}
          <div className="flex items-center gap-1.5 shrink-0">
            <ReaderTooltip
              title={isFullscreen ? "Thu nhỏ cửa sổ" : "Toàn màn hình trình duyệt"}
              description="Chuyển đổi chế độ toàn màn hình Native của trình duyệt."
              align="end"
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={toggleNativeFullscreen}
                className="flex size-8 shrink-0 items-center justify-center p-0 rounded-lg border border-[#e5e5e5] text-ash hover:text-charcoal cursor-pointer"
                aria-label={isFullscreen ? "Thu nhỏ cửa sổ trình duyệt" : "Toàn màn hình trình duyệt"}
              >
                {isFullscreen ? <Shrink className="size-4" /> : <Expand className="size-4" />}
              </Button>
            </ReaderTooltip>

            <ReaderTooltip
              title="Thoát Focus Mode"
              description="Hiện lại thanh menu và bảng phân tích cú pháp."
              shortcut="Esc"
              align="end"
            >
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsFocusMode(false)}
                className="flex size-8 shrink-0 items-center justify-center p-0 rounded-lg bg-macaw-blue text-white hover:bg-[#16a5e8] border-b-2 border-b-[#1282b8] active:translate-y-0.5 cursor-pointer"
                aria-label="Thoát Focus Mode"
              >
                <Minimize2 className="size-4" />
              </Button>
            </ReaderTooltip>
          </div>
        </header>
      ) : (
        /* Normal Header: Đầy đủ các nút công cụ */
        <header className="mb-2.5 flex h-14 shrink-0 items-center justify-between gap-2.5 rounded-2xl border-2 border-b-4 border-[#e5e5e5] bg-white px-3 md:px-4 shadow-xs">
          {/* Bên trái: Nút Back, Nút Mục lục TOC (kèm badge số chương), Tên tài liệu, Badge số trang/phần */}
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 overflow-hidden">
            <ReaderTooltip
              title="Quay về trang chủ"
              description="Trở lại màn hình chính của Vocabloom."
              align="start"
            >
              <Link
                href="/"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#e5e5e5] text-ash hover:bg-gray-100 hover:text-charcoal transition-colors"
                aria-label="Quay về trang chủ"
              >
                <ArrowLeft className="size-4" />
              </Link>
            </ReaderTooltip>

            {/* Nút mở Mục lục TOC */}
            <ReaderTooltip
              title="Mục lục & Thư viện"
              description="Mở danh sách các chương mục và các tài liệu đã lưu."
              align="start"
            >
              <button
                type="button"
                onClick={() => setIsTocOpen(true)}
                className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#e5e5e5] px-2 text-xs font-bold text-eel-dark-blue hover:bg-[#e5f6fd] hover:text-[#1cb0f6] transition-colors cursor-pointer"
                aria-label="Mục lục & Thư viện tài liệu"
              >
                <Menu className="size-4 text-[#1cb0f6]" />
                <span className="hidden sm:inline">Mục lục</span>
                {documentMeta?.toc && documentMeta.toc.length > 0 && (
                  <span className="rounded-full bg-[#e5f6fd] px-1.5 py-0.2 text-[10px] font-black text-[#087db4]">
                    {documentMeta.toc.length}
                  </span>
                )}
              </button>
            </ReaderTooltip>

            {/* Tên tài liệu */}
            <h1
              className="text-xs sm:text-sm md:text-[15px] font-black text-eel-dark-blue truncate min-w-0 flex-1"
              title={documentMeta?.title || "Tài liệu"}
            >
              {documentMeta?.title || "Đang tải tài liệu..."}
            </h1>

            {/* Badge số trang / phần */}
            {documentMeta && (
              <Badge
                variant="blue"
                className="hidden 2xl:inline-flex text-[10px] py-0 px-2 min-h-6 shrink-0"
              >
                {documentMeta.totalPages} trang · {documentMeta.totalChunks} phần
              </Badge>
            )}
          </div>

          {/* Ở giữa: Bộ điều hướng Chunk phân trang & Huy hiệu AI Readiness */}
          <div className="flex items-center justify-center gap-2 shrink-0">
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
            {renderAiReadinessBadge()}
            {activeChunk?.repairedRawText && (
              <ReaderTooltip
                title="Bố cục đã tối ưu bằng AI"
                description="Bố cục văn bản của phần này đã được Semantic Repair AI sửa lỗi rách chữ (kerning), nối từ gãy dòng và chuẩn hóa đề mục/bảng biểu."
                badge="Layout Clean"
                badgeVariant="amber"
              >
                <div
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-amber-300 bg-[#fefce8] text-amber-800 shadow-2xs cursor-default"
                  aria-label="Bố cục đã tối ưu bằng AI"
                >
                  <Zap className="size-4 fill-amber-500 text-amber-500" />
                </div>
              </ReaderTooltip>
            )}
          </div>

          {/* Bên phải: Nút "Lưu phiên học", "Nhập tài liệu", "Local AI Config", và nút bật Focus Mode */}
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            <ReaderTooltip
              title={isDocumentSaved ? "Đã lưu an toàn" : "Lưu phiên học"}
              description={
                isDocumentSaved
                  ? "Phiên học, vị trí đọc và toàn bộ phân tích AI đã được đồng bộ vào IndexedDB (.vdoc)."
                  : "Lưu tài liệu, tiến độ và phân tích câu vào bộ nhớ trình duyệt (.vdoc) để đọc offline."
              }
              badge={isDocumentSaved ? "vdoc" : undefined}
              badgeVariant="green"
              align="end"
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSaveSession}
                disabled={isSavingSession || !documentMeta || isDocumentSaved}
                className={`flex size-8 shrink-0 items-center justify-center p-0 rounded-lg transition-all ${
                  isDocumentSaved
                    ? "border border-[#a5ed6e] bg-[#f7fff1] text-[#438f0e] cursor-default opacity-90"
                    : "border-[#e5e5e5] text-charcoal hover:bg-gray-100 cursor-pointer"
                }`}
                aria-label={
                  isDocumentSaved
                    ? "Tài liệu đã được lưu trong IndexedDB (.vdoc)"
                    : "Lưu phiên học và tiến độ vào IndexedDB (.vdoc)"
                }
              >
                {isSavingSession ? (
                  <Loader2 className="size-4 animate-spin text-[#1cb0f6]" />
                ) : isDocumentSaved ? (
                  <Check className="size-4 text-[#438f0e]" />
                ) : (
                  <Save className="size-4 text-ecto-green" />
                )}
              </Button>
            </ReaderTooltip>

            <ReaderTooltip
              title="Nhập tài liệu mới"
              description="Tải lên tệp PDF học thuật, Word (.docx), hình ảnh scan OCR hoặc dán văn bản tiếng Anh để bắt đầu đọc."
              align="end"
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsImporting(true)}
                className="flex size-8 shrink-0 items-center justify-center p-0 rounded-lg border border-[#e5e5e5] text-charcoal hover:bg-gray-100 hover:text-[#1cb0f6] cursor-pointer"
                aria-label="Nhập tài liệu (Text, PDF, Word, Ảnh)"
              >
                <FilePlus2 className="size-4 text-[#1cb0f6]" />
              </Button>
            </ReaderTooltip>

            <ReaderTooltip
              title="Cấu hình Trợ lý AI"
              description={`Mô hình: ${aiConfig.model} • Provider: ${aiConfig.provider}. Bấm để điều chỉnh endpoint và nhiệt độ.`}
              badge={aiConfig.model.split("/").pop() || "AI"}
              badgeVariant="blue"
              align="end"
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsConfigOpen(true)}
                className="relative flex size-8 shrink-0 items-center justify-center p-0 rounded-lg border border-[#e5e5e5] text-charcoal hover:bg-gray-100 hover:text-[#1cb0f6] cursor-pointer"
                aria-label="Cài đặt Local AI Endpoint"
              >
                <Settings2 className="size-4 text-[#1cb0f6]" />
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-emerald-500 ring-2 ring-white" />
              </Button>
            </ReaderTooltip>

            {/* Nút bật Focus Mode toàn màn hình (chỉ hiển thị icon) */}
            <ReaderTooltip
              title="Chế độ tập trung (Focus Mode)"
              description="Ẩn thanh công cụ để đọc toàn màn hình, chỉ làm nổi bật câu đang chọn để chống mỏi mắt."
              shortcut="F"
              align="end"
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsFocusMode(true)}
                className="flex size-8 shrink-0 items-center justify-center p-0 rounded-lg border border-[#e5e5e5] text-charcoal hover:bg-[#f0f9ff] hover:border-[#bfe9fd] hover:text-[#0284c7] transition-all cursor-pointer"
                aria-label="Bật chế độ tập trung (Focus Mode - Phím F)"
              >
                <Maximize2 className="size-4 text-[#1cb0f6]" />
              </Button>
            </ReaderTooltip>
          </div>
        </header>
      )}

      {/* Main Content Area: Cả 2 Panel hiển thị song hành tận dụng 100% diện tích màn hình */}
      <main className="flex-1 overflow-hidden">
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
              isEnriching={isEnriching}
              error={analysisError}
              selectedSentenceText={activeSentence?.text || null}
              onRetry={() => activeSentence && handleAnalyzeSentence(activeSentence)}
              onOpenAIConfig={() => setIsConfigOpen(true)}
              onSaveWordToDeck={handleSaveWordToDeck}
              onClosePanel={isFocusMode ? () => setIsFocusMode(false) : undefined}
            />
          </section>
        </div>
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
        isDocumentSaved={isDocumentSaved}
        analyzedSentencesCount={analyzedSentencesCount}
        chunkAnalyzedCount={chunkAnalyzedCount}
        totalChunkSentences={allChunkSentences.length}
        isPreanalyzingChunk={isPreanalyzingChunk}
        onStartPreanalyzeChunk={handleStartPreanalyzeChunk}
        onStopPreanalyzeChunk={handleStopPreanalyzeChunk}
        onClearDocumentAnalyses={handleClearDocumentAnalyses}
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

      {/* Toast Message thông báo */}
      {toastMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-charcoal/90 text-white px-4 py-2 text-xs font-bold shadow-lg animate-in fade-in slide-in-from-bottom-2">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
