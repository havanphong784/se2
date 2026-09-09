"use client";

import React, { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Settings2,
  FilePlus2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InteractiveReader } from "@/components/reading/interactive-reader";
import { SentenceBreakdownCard } from "@/components/reading/sentence-breakdown-card";
import { DocumentImporter } from "@/components/reading/document-importer";
import { AIConfigModal } from "@/components/reading/ai-config-modal";
import { segmentText } from "@/lib/reading/text-segmenter";
import {
  getSavedAIConfig,
  analyzeSentence,
  getCachedAnalysis,
} from "@/lib/ai/local-ai-client";
import type {
  SentenceItem,
  SentenceBreakdownResponse,
  ClientAIConfig,
} from "@/types/reading";

const DEFAULT_SAMPLE_DOC = {
  title: "The Impact of Artificial Intelligence",
  content: `The rapid advance of artificial intelligence has raised profound questions about the future of work. Rarely have engineers and scholars witnessed technological shifts occurring at such an unprecedented velocity.

While some routine occupations may gradually diminish, modern organizations must foster human resilience and adaptability. By integrating cutting-edge tools with creative problem-solving, individuals can unlock extraordinary potential and thrive in this evolving landscape.`,
};

export default function ReadingPage() {
  const [docTitle, setDocTitle] = useState(DEFAULT_SAMPLE_DOC.title);
  const [rawContent, setRawContent] = useState(DEFAULT_SAMPLE_DOC.content);
  const [isImporting, setIsImporting] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [aiConfig, setAiConfig] = useState<ClientAIConfig>(() => getSavedAIConfig());

  // Derive parsedData trực tiếp từ rawContent mà không cần useEffect setState
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
  const [analysisData, setAnalysisData] = useState<SentenceBreakdownResponse | null>(() => {
    const firstSentence = DEFAULT_SAMPLE_DOC.content.split(".")[0] + ".";
    return getCachedAnalysis(firstSentence);
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Map từ vựng theo ngữ cảnh để popover hiển thị tức thì
  const [contextVocabMap, setContextVocabMap] = useState<
    Record<string, { meaning: string; ipa: string }>
  >({});

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
            title: `Smart Reader: ${docTitle}`,
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

  const handleImportComplete = (text: string, title: string) => {
    setRawContent(text);
    setDocTitle(title);
    setSelectedSentenceId(null);
    setAnalysisData(null);
    setIsImporting(false);
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-[1500px] flex-col px-4 py-4 md:px-6">
      {/* Header bar */}
      <header className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-b-4 border-[#e5e5e5] bg-white p-3.5 md:px-5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex size-9 items-center justify-center rounded-xl border-2 border-[#e5e5e5] text-ash hover:bg-gray-100 hover:text-charcoal transition-colors"
            title="Quay về trang chủ"
          >
            <ArrowLeft className="size-4.5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-black text-eel-dark-blue truncate max-w-xs md:max-w-md">
                {docTitle}
              </h1>
              <Badge variant="blue" className="text-[10px]">
                {parsedData.totalWords} từ · {parsedData.totalSentences} câu
              </Badge>
            </div>
            <p className="text-[11px] font-bold text-ash">
              Đọc hiểu thông minh chia đôi màn hình &amp; Bóc tách câu từ bằng Local AI
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsImporting(true)}
            className="gap-1.5 font-bold"
          >
            <FilePlus2 className="size-4" /> Đổi tài liệu
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsConfigOpen(true)}
            className="gap-1.5 font-bold"
          >
            <Settings2 className="size-4 text-[#1cb0f6]" />
            <span className="hidden sm:inline">Local AI:</span>
            <span className="font-mono text-xs text-charcoal">{aiConfig.model}</span>
          </Button>
        </div>
      </header>

      {/* Main Content Area (Split View Layout) */}
      <main className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-12">
        {/* Cột trái: Văn bản gốc & Interactive Highlighter (7/12 cols ~ 58%) */}
        <section className="flex flex-col h-full lg:col-span-7 overflow-hidden">
          <InteractiveReader
            paragraphs={parsedData.paragraphs}
            activeSentenceId={activeSentence?.id || null}
            onSelectSentence={handleAnalyzeSentence}
            onSaveWordToDeck={handleSaveWordToDeck}
            contextVocabMap={contextVocabMap}
          />
        </section>

        {/* Cột phải: Bóc tách câu chi tiết bằng Local AI (5/12 cols ~ 42%) */}
        <section className="flex flex-col h-full lg:col-span-5 overflow-hidden">
          <SentenceBreakdownCard
            data={analysisData}
            isLoading={isAnalyzing}
            error={analysisError}
            selectedSentenceText={activeSentence?.text || null}
            onRetry={() => activeSentence && handleAnalyzeSentence(activeSentence)}
            onOpenAIConfig={() => setIsConfigOpen(true)}
            onSaveWordToDeck={handleSaveWordToDeck}
          />
        </section>
      </main>

      {/* Modal Cài đặt Local AI */}
      <AIConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onConfigUpdated={(cfg) => setAiConfig(cfg)}
      />

      {/* Modal Nhập Tài liệu (Text, PDF, Ảnh OCR) */}
      {isImporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-2xl">
            <DocumentImporter
              onImportComplete={handleImportComplete}
              onCancel={() => setIsImporting(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
