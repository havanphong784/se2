"use client";

import React, { useState, useMemo } from "react";
import {
  Sparkles,
  BookOpen,
  Check,
  Plus,
  Volume2,
  HelpCircle,
  Loader2,
  RefreshCw,
  Layers,
  PanelRightClose,
  Languages,
  BookMarked,
  CheckCheck,
  Boxes,
  Workflow,
  Lightbulb,
  Cpu,
  Brain,
  Footprints,
  GitFork,
  ArrowRight,
  Settings2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  SentenceBreakdownResponse,
  ContextualVocab,
  SkeletonPart,
  SentenceComplexity,
} from "@/types/reading";

interface SentenceBreakdownCardProps {
  data: SentenceBreakdownResponse | null;
  isLoading: boolean;
  isEnriching?: boolean;
  error: string | null;
  selectedSentenceText: string | null;
  onRetry?: () => void;
  onOpenAIConfig: () => void;
  onSaveWordToDeck?: (word: string, translation: string, phonetic: string) => Promise<void>;
  onClosePanel?: () => void;
}

const SKELETON_ROLE_CONFIG: Record<
  string,
  { label: string; shortLabel: string; badgeClass: string; boxClass: string }
> = {
  S: {
    label: "Chủ ngữ",
    shortLabel: "S",
    badgeClass: "bg-blue-600 text-white",
    boxClass: "bg-blue-50/70 border-blue-200 text-blue-900",
  },
  V: {
    label: "Động từ",
    shortLabel: "V",
    badgeClass: "bg-amber-600 text-white",
    boxClass: "bg-amber-50/70 border-amber-200 text-amber-900",
  },
  O: {
    label: "Tân ngữ",
    shortLabel: "O",
    badgeClass: "bg-purple-600 text-white",
    boxClass: "bg-purple-50/70 border-purple-200 text-purple-900",
  },
  C: {
    label: "Bổ ngữ",
    shortLabel: "C",
    badgeClass: "bg-cyan-600 text-white",
    boxClass: "bg-cyan-50/70 border-cyan-200 text-cyan-900",
  },
  A: {
    label: "Trạng ngữ",
    shortLabel: "A",
    badgeClass: "bg-emerald-600 text-white",
    boxClass: "bg-emerald-50/70 border-emerald-200 text-emerald-900",
  },
};

const CHUNK_TYPE_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  noun_phrase: { label: "Cụm DT", badgeClass: "bg-blue-50 text-blue-700 border-blue-200" },
  verb_phrase: { label: "Cụm ĐT", badgeClass: "bg-amber-50 text-amber-700 border-amber-200" },
  prepositional_phrase: { label: "Cụm giới từ", badgeClass: "bg-teal-50 text-teal-700 border-teal-200" },
  adverbial_phrase: { label: "Cụm trạng từ", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  clause: { label: "Mệnh đề", badgeClass: "bg-purple-50 text-purple-700 border-purple-200" },
};

const COMPLEXITY_CONFIG: Record<SentenceComplexity, { label: string; colorClass: string }> = {
  micro: { label: "Ngắn / Mệnh lệnh", colorClass: "border-gray-200 bg-gray-100 text-gray-700" },
  simple: { label: "Câu đơn", colorClass: "border-blue-200 bg-blue-50 text-blue-700" },
  compound: { label: "Câu ghép", colorClass: "border-amber-200 bg-amber-50 text-amber-700" },
  complex: { label: "Câu phức", colorClass: "border-purple-200 bg-purple-50 text-purple-700" },
};

export function SentenceBreakdownCard({
  data,
  isLoading,
  isEnriching = false,
  error,
  selectedSentenceText,
  onRetry,
  onOpenAIConfig,
  onSaveWordToDeck,
  onClosePanel,
}: SentenceBreakdownCardProps) {
  // Trạng thái 3 tab: "meaning" (Ý nghĩa & Quiz), "syntax" (Cú pháp & Ngữ pháp), "lexicon" (Từ vựng & Tư duy)
  const [activeTab, setActiveTab] = useState<"meaning" | "syntax" | "lexicon">("meaning");

  // Trạng thái lưu từ vựng
  const [savedWords, setSavedWords] = useState<Record<string, boolean>>({});
  const [savingWord, setSavingWord] = useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = useState(false);

  // Trạng thái chọn đáp án câu hỏi Socratic (lưu theo câu để bảo toàn câu trả lời của người học)
  const [selectedQuizBySentence, setSelectedQuizBySentence] = useState<Record<string, number>>({});
  const selectedQuizOption =
    data?.sentence && selectedQuizBySentence[data.sentence] !== undefined
      ? selectedQuizBySentence[data.sentence]
      : null;

  const handleSaveWord = async (vocab: ContextualVocab) => {
    if (!onSaveWordToDeck || savedWords[vocab.term]) return;

    setSavingWord(vocab.term);
    try {
      await onSaveWordToDeck(vocab.term, vocab.contextMeaningVi, vocab.ipa);
      setSavedWords((prev) => ({ ...prev, [vocab.term]: true }));
    } catch {
      // ignore
    } finally {
      setSavingWord(null);
    }
  };

  const handleSaveAllWords = async () => {
    if (!onSaveWordToDeck || !data?.vocabulary || data.vocabulary.length === 0 || isSavingAll) {
      return;
    }

    setIsSavingAll(true);
    try {
      const processedTerms = new Set<string>();
      for (const vocab of data.vocabulary) {
        if (!savedWords[vocab.term] && !processedTerms.has(vocab.term)) {
          processedTerms.add(vocab.term);
          await onSaveWordToDeck(vocab.term, vocab.contextMeaningVi, vocab.ipa);
          setSavedWords((prev) => ({ ...prev, [vocab.term]: true }));
        }
      }
    } catch {
      // ignore
    } finally {
      setIsSavingAll(false);
    }
  };

  const vocabulary = data?.vocabulary;
  const allWordsSaved = useMemo(() => {
    if (!vocabulary || vocabulary.length === 0) return false;
    return vocabulary.every((v) => savedWords[v.term]);
  }, [vocabulary, savedWords]);

  const playSentenceAudio = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "en-US";
      utter.rate = 0.95;
      window.speechSynthesis.speak(utter);
    }
  };

  // 1. Trạng thái chưa chọn câu (Empty State)
  if (!selectedSentenceText) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#d9d9d9] bg-[#fafafa] p-6 text-center">
        {onClosePanel && (
          <button
            type="button"
            onClick={onClosePanel}
            className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-lg text-ash hover:bg-gray-200 hover:text-charcoal transition-colors cursor-pointer"
            title="Thu gọn bảng phân tích"
          >
            <PanelRightClose className="size-4" />
          </button>
        )}
        <div className="flex size-12 items-center justify-center rounded-2xl border-2 border-[#bfe9fd] bg-[#f0f9ff] text-[#1cb0f6]">
          <BookOpen className="size-6" />
        </div>
        <h3 className="mt-3 text-sm font-black text-eel-dark-blue">
          Chọn một câu trong bài đọc
        </h3>
        <p className="mt-1 max-w-xs text-xs font-medium leading-relaxed text-ash">
          Click vào bất kỳ câu nào để AI phân tích 3 tab công thái học: Ý nghĩa &amp; Quiz, Cú pháp S-V-O, và Từ vựng &amp; Tư duy.
        </p>

        {/* Shortcut guide */}
        <div className="mt-3.5 flex items-center gap-1.5 rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-medium text-ash shadow-2xs">
          <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-charcoal">↑</kbd>
          <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-charcoal">↓</kbd>
          <span className="text-[11px]">hoặc</span>
          <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-charcoal">J</kbd>
          <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-charcoal">K</kbd>
          <span className="text-[11px] font-semibold text-charcoal">để chuyển câu</span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenAIConfig}
          className="mt-4 gap-1.5 font-bold text-xs cursor-pointer"
        >
          <Sparkles className="size-3.5" /> Cài đặt Local AI Endpoint
        </Button>
      </div>
    );
  }

  // 2. Trạng thái đang tải hoàn toàn (Loading Skeleton khi chưa có bất kỳ dữ liệu nào)
  if (isLoading && !data) {
    return (
      <div className="flex h-full flex-col rounded-2xl border-2 border-[#e5e5e5] bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-3">
          <div className="flex items-center gap-2.5">
            <Loader2 className="size-4 animate-spin text-[#1cb0f6]" />
            <div className="text-xs font-bold text-eel-dark-blue">
              <span>Local AI đang bóc tách câu...</span>
              <span className="block text-[11px] font-normal text-ash">
                Đang mổ xẻ khung S-V-O, cụm nghĩa, từ vựng và câu hỏi đọc hiểu
              </span>
            </div>
          </div>
          {onClosePanel && (
            <button
              type="button"
              onClick={onClosePanel}
              className="flex size-7 items-center justify-center rounded-lg text-ash hover:bg-gray-100 hover:text-charcoal transition-colors cursor-pointer"
              title="Thu gọn bảng phân tích"
            >
              <PanelRightClose className="size-4" />
            </button>
          )}
        </div>

        <div className="mt-4 space-y-3 animate-pulse">
          <div className="h-10 rounded-xl bg-gray-100" />
          <div className="h-20 rounded-xl bg-gray-100" />
          <div className="h-16 rounded-xl bg-gray-100" />
          <div className="h-24 rounded-xl bg-gray-100" />
        </div>
      </div>
    );
  }

  // 3. Trạng thái lỗi (Error State khi hoàn toàn không có dữ liệu bản dịch)
  if (error && !data) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center rounded-2xl border-2 border-[#ffccd5] bg-[#fff8f8] p-6 text-center">
        {onClosePanel && (
          <button
            type="button"
            onClick={onClosePanel}
            className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-lg text-ash hover:bg-gray-100 hover:text-charcoal transition-colors cursor-pointer"
            title="Thu gọn bảng phân tích"
          >
            <PanelRightClose className="size-4" />
          </button>
        )}
        <div className="flex size-11 items-center justify-center rounded-xl bg-[#ffe4e6] text-[#e11d48]">
          <HelpCircle className="size-5" />
        </div>
        <h3 className="mt-3 text-sm font-black text-[#be123c]">
          Không thể phân tích câu này
        </h3>
        <p className="mt-1 max-w-sm text-xs text-ash">
          {error || "Mô hình AI không phản hồi hoặc endpoint bị gián đoạn."}
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {onRetry && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onRetry}
              className="gap-1.5 font-bold text-xs cursor-pointer"
            >
              <RefreshCw className="size-3.5" /> Thử lại
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenAIConfig}
            className="gap-1.5 font-bold text-xs cursor-pointer"
          >
            <Sparkles className="size-3.5" /> Kiểm tra cấu hình AI
          </Button>
        </div>
      </div>
    );
  }

  // 4. Nếu chưa có data nhưng đã có selectedSentenceText
  if (!data) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center rounded-2xl border-2 border-[#e5e5e5] bg-[#fafafa] p-6 text-center">
        {onClosePanel && (
          <button
            type="button"
            onClick={onClosePanel}
            className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-lg text-ash hover:bg-gray-100 hover:text-charcoal transition-colors cursor-pointer"
            title="Thu gọn bảng phân tích"
          >
            <PanelRightClose className="size-4" />
          </button>
        )}
        <div className="flex size-12 items-center justify-center rounded-2xl border-2 border-[#bfe9fd] bg-[#f0f9ff] text-[#1cb0f6]">
          <Sparkles className="size-6 text-[#1cb0f6] animate-pulse" />
        </div>
        <h3 className="mt-3 text-sm font-black text-eel-dark-blue">
          Sẵn sàng phân tích câu
        </h3>
        <p className="mt-1 max-w-sm text-xs font-semibold text-charcoal italic line-clamp-3 px-2">
          &ldquo;{selectedSentenceText}&rdquo;
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {onRetry && (
            <Button
              variant="default"
              size="sm"
              onClick={onRetry}
              className="gap-1.5 font-bold text-xs bg-ecto-green text-white hover:bg-[#51bd02] cursor-pointer"
            >
              <Sparkles className="size-3.5" /> Bắt đầu phân tích
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenAIConfig}
            className="gap-1.5 font-bold text-xs cursor-pointer"
          >
            <Settings2 className="size-3.5" /> Cài đặt AI
          </Button>
        </div>
      </div>
    );
  }

  const vocabCount = data.vocabulary?.length || 0;
  const idiomsCount = data.idiomsAndPhrases?.length || 0;
  const skeletonParts = data.skeleton?.parts || [];
  const clauses =
    data.clauses && data.clauses.length > 0
      ? data.clauses
      : data.grammar?.clauses || [];
  const chunks = data.chunks || [];
  const mentalModelSteps = data.mentalModelSteps || [];
  const complexityConfig = data.complexity ? COMPLEXITY_CONFIG[data.complexity] : null;

  // 5. Giao diện 3-Tab Inspector Card theo chuẩn công thái học thị giác
  return (
    <div className="flex h-full flex-col rounded-2xl border-2 border-b-4 border-[#e5e5e5] bg-white shadow-xs overflow-hidden">
      {/* Header cố định của Card */}
      <div className="border-b border-[#f0f0f0] bg-[#fafafa]/90 p-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {complexityConfig && (
              <span
                className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10.5px] font-extrabold ${complexityConfig.colorClass} shrink-0`}
              >
                {complexityConfig.label}
              </span>
            )}

            {data.cefrLevel && (
              <span className="inline-flex items-center rounded-lg border border-[#bfe9fd] bg-[#e5f6fd] px-2 py-0.5 text-[10.5px] font-black text-[#087db4] shrink-0">
                CEFR {data.cefrLevel}
              </span>
            )}

            {isEnriching && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#bfe9fd] bg-[#e5f6fd] px-2 py-0.5 text-[10px] font-bold text-[#087db4] animate-pulse shrink-0">
                <Loader2 className="size-3 animate-spin text-[#1cb0f6]" />
                <span>Đang phân tích sâu...</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => playSentenceAudio(data.sentence)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-[#1cb0f6] hover:bg-[#e5f6fd] transition-colors cursor-pointer"
              title="Nghe phát âm câu"
            >
              <Volume2 className="size-3.5" />
              <span className="hidden sm:inline">Nghe</span>
            </button>

            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="flex size-7 items-center justify-center rounded-lg text-ash hover:bg-gray-200 hover:text-charcoal transition-colors cursor-pointer"
                title="Phân tích lại câu này"
              >
                <RefreshCw className="size-3.5" />
              </button>
            )}

            {onClosePanel && (
              <button
                type="button"
                onClick={onClosePanel}
                className="flex size-7 items-center justify-center rounded-lg text-ash hover:bg-gray-200 hover:text-charcoal transition-colors cursor-pointer"
                title="Thu gọn bảng phân tích (Zen Mode)"
              >
                <PanelRightClose className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Trích dẫn câu đang chọn */}
        <p className="mt-2 text-xs font-semibold italic text-charcoal leading-relaxed line-clamp-2">
          &ldquo;{data.sentence}&rdquo;
        </p>

        {/* Thông báo nhẹ nếu có lỗi phân tích chuyên sâu */}
        {error && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-[#ffe0e6] bg-[#fff5f7] p-2 text-xs font-bold text-[#c92a2a]">
            <span>⚠️ {error}</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="shrink-0 underline text-[11px] hover:text-[#a61e1e] cursor-pointer"
              >
                Thử lại AI
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tab bar 3 tab nhỏ gọn công thái học */}
      <div className="flex items-center gap-1 border-b border-[#f0f0f0] bg-[#f8fafc] p-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("meaning")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-bold transition-all cursor-pointer",
            activeTab === "meaning"
              ? "bg-white text-eel-dark-blue shadow-xs border border-gray-200 font-extrabold"
              : "text-ash hover:text-charcoal hover:bg-gray-100"
          )}
        >
          <Languages className="size-3.5 text-emerald-600 shrink-0" />
          <span>Ý nghĩa</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("syntax")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-bold transition-all cursor-pointer",
            activeTab === "syntax"
              ? "bg-white text-eel-dark-blue shadow-xs border border-gray-200 font-extrabold"
              : "text-ash hover:text-charcoal hover:bg-gray-100"
          )}
        >
          <Boxes className="size-3.5 text-blue-600 shrink-0" />
          <span>Cú pháp</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("lexicon")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-bold transition-all cursor-pointer",
            activeTab === "lexicon"
              ? "bg-white text-eel-dark-blue shadow-xs border border-gray-200 font-extrabold"
              : "text-ash hover:text-charcoal hover:bg-gray-100"
          )}
        >
          <BookMarked className="size-3.5 text-purple-600 shrink-0" />
          <span className="truncate">Từ vựng &amp; Flow</span>
          {vocabCount > 0 && (
            <span className="rounded-full bg-purple-100 text-purple-800 px-1.5 py-0.2 text-[10px] font-black shrink-0">
              {vocabCount}
            </span>
          )}
        </button>
      </div>

      {/* Vùng nội dung cuộn theo từng tab */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* ======================================================== */}
        {/* TAB 1: Ý NGHĨA (MEANING, SIMPLIFIED ENGLISH & SOCRATIC QUIZ) */}
        {/* ======================================================== */}
        {activeTab === "meaning" && (
          <div className="space-y-3.5">
            {/* Bản dịch tiếng Việt ngữ cảnh */}
            <section className="rounded-xl border border-[#d2f4a6] bg-[#f9fdf5] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#438f0e]">
                  <Languages className="size-3.5" /> Bản dịch ngữ cảnh
                </span>
                <button
                  type="button"
                  onClick={() => playSentenceAudio(data.sentence)}
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-[#438f0e] hover:bg-[#ecfccb] transition-colors cursor-pointer"
                >
                  <Volume2 className="size-3" /> Nghe câu
                </button>
              </div>

              {data.translationVi ? (
                <p className="text-sm md:text-[15px] font-extrabold text-eel-dark-blue leading-relaxed">
                  {data.translationVi}
                </p>
              ) : (
                <div className="flex items-center gap-2 py-1 text-xs font-bold text-ash animate-pulse">
                  <Loader2 className="size-3.5 animate-spin text-[#1cb0f6]" />
                  <span>Đang tải bản dịch ngữ cảnh...</span>
                </div>
              )}

              {/* Core Idea (Ý chính cốt lõi) */}
              {data.coreIdeaVi && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50/70 p-2.5">
                  <Lightbulb className="size-4 shrink-0 text-amber-600 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
                      Ý chính cốt lõi
                    </span>
                    <p className="text-xs font-bold text-eel-dark-blue leading-relaxed mt-0.5">
                      {data.coreIdeaVi}
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* Tiếng Anh đơn giản hóa (Simplified English) với Badge CEFR */}
            {(data.simplifiedEnglish || data.cefrLevel) && (
              <section className="rounded-xl border border-[#bfe9fd] bg-[#f0f9ff] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#087db4]">
                    <Sparkles className="size-3.5 text-[#1cb0f6]" /> Tiếng Anh đơn giản hóa
                  </span>
                  {data.cefrLevel && (
                    <Badge variant="blue" className="text-[10px] font-black py-0 px-2">
                      {data.cefrLevel}
                    </Badge>
                  )}
                </div>

                {data.simplifiedEnglish ? (
                  <p className="text-xs font-semibold text-eel-dark-blue leading-relaxed italic">
                    &ldquo;{data.simplifiedEnglish}&rdquo;
                  </p>
                ) : (
                  <p className="text-xs text-ash italic">Đang cập nhật phiên bản đơn giản hóa...</p>
                )}
              </section>
            )}

            {/* Socratic Active Comprehension Quiz */}
            <section className="rounded-xl border-2 border-purple-200 bg-purple-50/30 p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Brain className="size-4 text-purple-600" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-purple-900">
                    Socratic Comprehension Quiz
                  </h4>
                </div>
                <span className="rounded-full bg-purple-100 text-purple-800 px-2 py-0.5 text-[10px] font-extrabold">
                  Đọc hiểu chủ động
                </span>
              </div>

              {data.socraticQuestion ? (
                <div className="space-y-2.5">
                  {/* Câu hỏi */}
                  <p className="text-xs md:text-sm font-bold text-eel-dark-blue leading-relaxed">
                    {data.socraticQuestion.questionVi}
                  </p>

                  {/* Danh sách các lựa chọn */}
                  <div className="space-y-1.5">
                    {data.socraticQuestion.options.map((option, optIdx) => {
                      const isSelected = selectedQuizOption === optIdx;
                      const hasAnswered = selectedQuizOption !== null;
                      const isCorrect = optIdx === data.socraticQuestion?.correctIndex;

                      let btnClass = "border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50/40 text-charcoal";
                      if (hasAnswered) {
                        if (isCorrect) {
                          btnClass = "border-emerald-500 bg-emerald-50 text-emerald-900 font-bold shadow-2xs";
                        } else if (isSelected && !isCorrect) {
                          btnClass = "border-rose-500 bg-rose-50 text-rose-900 font-bold shadow-2xs";
                        } else {
                          btnClass = "border-gray-100 bg-gray-50/70 text-ash opacity-60";
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={hasAnswered}
                          onClick={() => {
                            if (data?.sentence) {
                              setSelectedQuizBySentence((prev) => ({
                                ...prev,
                                [data.sentence]: optIdx,
                              }));
                            }
                          }}
                          className={cn(
                            "w-full text-left flex items-start gap-2.5 rounded-xl border p-2.5 text-xs transition-all cursor-pointer",
                            btnClass
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold mt-0.5",
                              hasAnswered && isCorrect
                                ? "bg-emerald-600 text-white"
                                : hasAnswered && isSelected && !isCorrect
                                  ? "bg-rose-600 text-white"
                                  : "bg-gray-100 text-charcoal"
                            )}
                          >
                            {hasAnswered && isCorrect ? (
                              <Check className="size-3" />
                            ) : hasAnswered && isSelected && !isCorrect ? (
                              <X className="size-3" />
                            ) : (
                              String.fromCharCode(65 + optIdx)
                            )}
                          </span>
                          <span className="flex-1 leading-snug break-words">{option}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Lời giải thích phản hồi khi đã trả lời */}
                  {selectedQuizOption !== null && (
                    <div
                      className={cn(
                        "rounded-xl p-3 text-xs border transition-all animate-in fade-in slide-in-from-top-1",
                        selectedQuizOption === data.socraticQuestion.correctIndex
                          ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                          : "bg-rose-50 border-rose-200 text-rose-900"
                      )}
                    >
                      <div className="flex items-center gap-1.5 font-black mb-1">
                        {selectedQuizOption === data.socraticQuestion.correctIndex ? (
                          <>
                            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                            <span>Chính xác!</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="size-4 text-rose-600 shrink-0" />
                            <span>Chưa chính xác</span>
                          </>
                        )}
                      </div>
                      <p className="leading-relaxed font-medium">
                        {data.socraticQuestion.explanationVi}
                      </p>
                    </div>
                  )}
                </div>
              ) : isEnriching ? (
                <div className="flex items-center gap-2 py-2 text-xs font-bold text-ash animate-pulse">
                  <Loader2 className="size-3.5 animate-spin text-purple-600" />
                  <span>AI đang soạn câu hỏi đọc hiểu Socratic cho câu này...</span>
                </div>
              ) : data.complexity === "micro" ? (
                <p className="text-xs text-ash italic">
                  Câu ngắn hoặc mệnh lệnh đơn giản, không yêu cầu câu hỏi đọc hiểu chuyên sâu.
                </p>
              ) : (
                <p className="text-xs text-ash italic">
                  Chưa có câu hỏi đọc hiểu cho câu này. Hãy bấm Thử lại để AI phân tích.
                </p>
              )}
            </section>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: CÚ PHÁP (SKELETON S-V-O-A & CLAUSES & GRAMMAR WHY) */}
        {/* ======================================================== */}
        {activeTab === "syntax" && (
          <div className="space-y-4">
            {/* Khung xương câu S-V-O-A */}
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-blue-700">
                  <Boxes className="size-3.5" /> Khung xương câu (S-V-O-A)
                </span>
                {data.skeleton?.pattern && (
                  <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[10.5px] font-extrabold text-slate-700">
                    {data.skeleton.pattern}
                  </span>
                )}
              </div>

              {skeletonParts.length === 0 && isEnriching ? (
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-center space-y-1">
                  <Loader2 className="mx-auto size-3.5 animate-spin text-blue-600" />
                  <p className="text-xs font-bold text-blue-900">
                    Đang xác định khung xương S-V-O-A...
                  </p>
                </div>
              ) : skeletonParts.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {skeletonParts.map((part: SkeletonPart, idx: number) => {
                      const cfg = SKELETON_ROLE_CONFIG[part.type] || {
                        label: part.roleVi || "Thành phần",
                        shortLabel: part.type,
                        badgeClass: "bg-gray-600 text-white",
                        boxClass: "bg-gray-50 border-gray-200 text-gray-900",
                      };
                      return (
                        <div
                          key={idx}
                          className={`flex items-start gap-2 rounded-xl border p-2 text-xs transition-colors ${cfg.boxClass}`}
                        >
                          <span
                            className={`inline-flex shrink-0 items-center justify-center rounded-md px-1.5 py-0.5 font-mono text-[10px] font-black ${cfg.badgeClass}`}
                          >
                            [{cfg.shortLabel}]
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-extrabold uppercase opacity-80 block">
                              {part.roleVi || cfg.label}
                            </span>
                            <span className="font-semibold leading-snug break-words">
                              {part.text}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-ash italic">Chưa có thông tin khung câu.</p>
              )}
            </section>

            {/* Cấu trúc các mệnh đề (Clauses) */}
            <section className="space-y-2 pt-2 border-t border-[#eeeeee]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#087db4]">
                  <GitFork className="size-3.5" /> Bóc tách mệnh đề ({clauses.length})
                </span>
              </div>

              {clauses.length > 0 ? (
                <div className="space-y-2">
                  {clauses.map((clause, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-[#e5e5e5] bg-white p-2.5 space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-black uppercase text-[#1cb0f6]">
                          {clause.role}
                        </span>
                      </div>

                      <div className="font-mono text-xs text-charcoal italic leading-relaxed">
                        &ldquo;{clause.clauseText}&rdquo;
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {clause.subject && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800 border border-blue-100">
                            <strong className="font-bold text-blue-900">S:</strong> {clause.subject}
                          </span>
                        )}
                        {clause.verb && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-100">
                            <strong className="font-bold text-amber-900">V:</strong> {clause.verb}
                          </span>
                        )}
                        {clause.objectOrComplement && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-800 border border-purple-100">
                            <strong className="font-bold text-purple-900">O/C:</strong> {clause.objectOrComplement}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ash italic">Câu đơn giản gồm 1 mệnh đề chính đồng nhất.</p>
              )}
            </section>

            {/* Giải thích ngữ pháp chuyên sâu: Rule summary, Why used, Mechanic */}
            <section className="space-y-2 pt-2 border-t border-[#eeeeee]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-purple-700">
                  <Brain className="size-3.5" /> Giải thích ngữ pháp chuyên sâu
                </span>
              </div>

              <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3 space-y-2.5">
                <div>
                  <h4 className="text-xs font-black text-eel-dark-blue">
                    Cấu trúc: {data.grammar?.pattern || "Cấu trúc câu tiêu chuẩn"}
                  </h4>
                  {data.grammar?.explanation && (
                    <p className="text-xs font-medium text-charcoal leading-relaxed mt-1">
                      {data.grammar.explanation}
                    </p>
                  )}
                </div>

                {/* Quy tắc / Công thức tóm tắt */}
                {data.grammar?.ruleSummary && (
                  <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-2 text-xs">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-800 block">
                      Quy tắc tóm tắt:
                    </span>
                    <span className="font-mono text-xs font-bold text-purple-900 mt-0.5 block">
                      {data.grammar.ruleSummary}
                    </span>
                  </div>
                )}

                {/* Tại sao tác giả dùng cấu trúc này (Why used) */}
                {data.grammar?.whyUsedVi && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 text-xs">
                    <div className="flex items-center gap-1.5 text-amber-800 font-extrabold text-[11px] mb-1">
                      <Lightbulb className="size-3.5 text-amber-600" />
                      <span>Tại sao tác giả viết như vậy?</span>
                    </div>
                    <p className="font-medium text-charcoal leading-relaxed">
                      {data.grammar.whyUsedVi}
                    </p>
                  </div>
                )}

                {/* Cơ chế ngữ pháp & chia thì (Mechanics) */}
                {data.grammar?.mechanicVi && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-2.5 text-xs">
                    <div className="flex items-center gap-1.5 text-blue-800 font-extrabold text-[11px] mb-1">
                      <Layers className="size-3.5 text-blue-600" />
                      <span>Cơ chế cấu tạo ngữ pháp:</span>
                    </div>
                    <p className="font-medium text-charcoal leading-relaxed">
                      {data.grammar.mechanicVi}
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: TỪ VỰNG & TƯ DUY (SEMANTIC CHUNKS, VOCAB & MENTAL MODEL) */}
        {/* ======================================================== */}
        {activeTab === "lexicon" && (
          <div className="space-y-4">
            {/* Semantic Chunks (Đọc nối cụm nghĩa) */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-teal-700">
                  <Workflow className="size-3.5" /> Đọc nối cụm nghĩa ({chunks.length})
                </span>
              </div>

              {chunks.length === 0 && isEnriching ? (
                <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3 text-center space-y-1">
                  <Loader2 className="mx-auto size-3.5 animate-spin text-teal-600" />
                  <p className="text-xs font-bold text-teal-900">
                    Đang phân rã cụm nghĩa tự nhiên...
                  </p>
                </div>
              ) : chunks.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="space-y-1.5">
                    {chunks.map((chunk, idx) => {
                      const typeCfg = CHUNK_TYPE_CONFIG[chunk.type] || {
                        label: chunk.type || "Cụm từ",
                        badgeClass: "bg-gray-100 text-gray-700 border-gray-200",
                      };
                      return (
                        <div
                          key={idx}
                          className="group flex flex-col gap-1 rounded-xl border border-slate-200 bg-[#fafbfc] p-2.5 transition-colors hover:border-teal-300 hover:bg-white"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-eel-dark-blue">
                              {chunk.chunkText}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.2 text-[9.5px] font-extrabold border shrink-0 ${typeCfg.badgeClass}`}
                            >
                              {typeCfg.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs font-bold text-[#438f0e]">
                            <ArrowRight className="size-3 text-ash shrink-0" />
                            <span>{chunk.meaningVi}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </section>

            {/* Danh sách từ vựng trọng tâm & Họ từ */}
            <section className="space-y-2.5 pt-2 border-t border-[#eeeeee]">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-eel-dark-blue">
                  <BookMarked className="size-3.5 text-[#1cb0f6]" /> Từ vựng trọng tâm ({vocabCount})
                </span>

                {onSaveWordToDeck && vocabCount > 1 && (
                  <button
                    type="button"
                    onClick={handleSaveAllWords}
                    disabled={isSavingAll || allWordsSaved}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-black transition-all ${
                      allWordsSaved
                        ? "border border-[#a5ed6e] bg-[#f7fff1] text-[#438f0e]"
                        : "border border-[#46a302] bg-ecto-green text-white hover:bg-[#51bd02] active:translate-y-0.5 cursor-pointer"
                    }`}
                  >
                    {isSavingAll ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Đang lưu...</span>
                      </>
                    ) : allWordsSaved ? (
                      <>
                        <CheckCheck className="size-3.5" />
                        <span>Đã lưu hết</span>
                      </>
                    ) : (
                      <>
                        <Plus className="size-3.5" />
                        <span>Lưu tất cả ({vocabCount})</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {vocabCount === 0 && isEnriching ? (
                <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-4 text-center space-y-1">
                  <Loader2 className="mx-auto size-4 animate-spin text-[#1cb0f6]" />
                  <p className="text-xs font-black text-eel-dark-blue">
                    Đang trích xuất từ vựng, IPA &amp; họ từ ngữ cảnh...
                  </p>
                </div>
              ) : vocabCount === 0 ? (
                <div className="py-2 text-center text-xs text-ash italic">
                  Không có từ vựng riêng lẻ cần chú thích trong câu này.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.vocabulary?.map((item, idx) => {
                    const isSaved = savedWords[item.term];
                    const isSaving = savingWord === item.term;

                    return (
                      <div
                        key={idx}
                        className="group relative rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-2.5 transition-colors hover:border-[#bfe9fd] hover:bg-white"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-sm text-eel-dark-blue">
                                {item.term}
                              </span>
                              {item.ipa && (
                                <span className="font-mono text-xs text-ash">
                                  {item.ipa}
                                </span>
                              )}
                              {item.partOfSpeech && (
                                <span className="rounded bg-gray-100 px-1.5 py-0.2 text-[10px] font-bold text-charcoal">
                                  {item.partOfSpeech}
                                </span>
                              )}
                              {item.cefr && (
                                <span className="rounded bg-[#e5f6fd] px-1.5 py-0.2 text-[10px] font-black text-[#087db4]">
                                  {item.cefr}
                                </span>
                              )}
                              {item.isTechnicalTerm && (
                                <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.2 text-[10px] font-bold text-white shadow-2xs">
                                  <Cpu className="size-2.5" /> IT Term
                                </span>
                              )}
                            </div>

                            <p className="text-xs font-bold text-[#438f0e]">
                              🇻🇳 {item.contextMeaningVi}
                            </p>

                            {/* Họ từ (Word Family) */}
                            {item.wordFamily && item.wordFamily.length > 0 && (
                              <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-extrabold uppercase text-ash">
                                  Họ từ:
                                </span>
                                {item.wordFamily.map((wf, wfIdx) => (
                                  <span
                                    key={wfIdx}
                                    className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-1.5 py-0.5 text-[10.5px] font-medium text-charcoal shadow-2xs"
                                  >
                                    <span className="font-semibold text-eel-dark-blue">{wf.word}</span>
                                    {wf.partOfSpeech && (
                                      <span className="text-[9.5px] text-ash">({wf.partOfSpeech})</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {onSaveWordToDeck && (
                            <button
                              type="button"
                              onClick={() => handleSaveWord(item)}
                              disabled={isSaved || isSaving}
                              className={`flex shrink-0 size-7 items-center justify-center rounded-lg border transition-all ${
                                isSaved
                                  ? "border-[#a5ed6e] bg-[#f7fff1] text-[#438f0e]"
                                  : "border-[#e5e5e5] bg-white text-ash hover:border-[#46a302] hover:text-ecto-green active:scale-95 cursor-pointer"
                              }`}
                              title={isSaved ? "Đã lưu vào bộ từ" : "Lưu từ này"}
                            >
                              {isSaving ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : isSaved ? (
                                <Check className="size-3.5" />
                              ) : (
                                <Plus className="size-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Thành ngữ & Collocations */}
              {idiomsCount > 0 && (
                <div className="pt-2 border-t border-[#eeeeee] space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-ash block">
                    Cụm từ &amp; Thành ngữ ({idiomsCount})
                  </span>
                  <div className="space-y-1.5">
                    {data.idiomsAndPhrases?.map((item, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-[#e5f6fd] bg-[#f0f9ff] p-2 text-xs"
                      >
                        <span className="font-extrabold text-eel-dark-blue block">
                          {item.phrase}
                        </span>
                        <span className="text-ash font-medium mt-0.5 block">
                          🇻🇳 {item.meaningVi}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Dòng tư duy đọc hiểu tự nhiên (Mental Model Steps) */}
            {(mentalModelSteps.length > 0 || isEnriching) && (
              <section className="space-y-2 pt-2 border-t border-[#eeeeee]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-indigo-700">
                    <Footprints className="size-3.5" /> Dòng tư duy đọc hiểu tự nhiên
                  </span>
                </div>

                {mentalModelSteps.length === 0 && isEnriching ? (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-center space-y-1">
                    <Loader2 className="mx-auto size-3.5 animate-spin text-indigo-600" />
                    <p className="text-xs font-bold text-indigo-900">
                      Đang xây dựng sơ đồ tư duy đọc hiểu...
                    </p>
                  </div>
                ) : mentalModelSteps.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-ash">
                      Trình tự tiếp nhận thông tin xuôi dòng tự nhiên, không cần dịch ngược:
                    </p>
                    <div className="space-y-2">
                      {mentalModelSteps.map((step, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/40 to-white p-2.5 text-xs"
                        >
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 font-mono text-[10px] font-black text-white shadow-2xs mt-0.5">
                            {idx + 1}
                          </span>
                          <p className="font-semibold text-charcoal leading-relaxed">
                            {step}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
