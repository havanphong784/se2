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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SentenceBreakdownResponse, ContextualVocab } from "@/types/reading";

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

type TabKey = "meaning" | "grammar" | "vocab";

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
  const [activeTab, setActiveTab] = useState<TabKey>("meaning");
  const [savedWords, setSavedWords] = useState<Record<string, boolean>>({});
  const [savingWord, setSavingWord] = useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = useState(false);

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
      for (const vocab of data.vocabulary) {
        if (!savedWords[vocab.term]) {
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
            className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-lg text-ash hover:bg-gray-200 hover:text-charcoal transition-colors"
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
          Click vào bất kỳ câu nào để AI tiến hành phân tích ngữ pháp, dịch nghĩa và bóc tách từ vựng.
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
          className="mt-4 gap-1.5 font-bold text-xs"
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
              <span>Local AI đang phân tích câu...</span>
              <span className="block text-[11px] font-normal text-ash">
                Đang mổ xẻ ngữ pháp, ngữ nghĩa và từ vựng
              </span>
            </div>
          </div>
          {onClosePanel && (
            <button
              type="button"
              onClick={onClosePanel}
              className="flex size-7 items-center justify-center rounded-lg text-ash hover:bg-gray-100 hover:text-charcoal transition-colors"
              title="Thu gọn bảng phân tích"
            >
              <PanelRightClose className="size-4" />
            </button>
          )}
        </div>

        <div className="mt-4 space-y-3 animate-pulse">
          <div className="h-14 rounded-xl bg-gray-100" />
          <div className="h-10 rounded-xl bg-gray-100" />
          <div className="h-28 rounded-xl bg-gray-100" />
          <div className="h-28 rounded-xl bg-gray-100" />
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
            className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-lg text-ash hover:bg-gray-100 hover:text-charcoal transition-colors"
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
              className="gap-1.5 font-bold text-xs"
            >
              <RefreshCw className="size-3.5" /> Thử lại
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenAIConfig}
            className="gap-1.5 font-bold text-xs"
          >
            <Sparkles className="size-3.5" /> Kiểm tra cấu hình AI
          </Button>
        </div>
      </div>
    );
  }

  // 4. Nếu chưa có data nhưng đã có selectedSentenceText (ví dụ vừa đổi chunk, hoặc đang đợi phân tích)
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
            <Sparkles className="size-3.5" /> Cài đặt AI
          </Button>
        </div>
      </div>
    );
  }

  const vocabCount = data.vocabulary?.length || 0;
  const idiomsCount = data.idiomsAndPhrases?.length || 0;

  // 4. Giao diện dạng Tab (Tabbed Inspector)
  return (
    <div className="flex h-full flex-col rounded-2xl border-2 border-b-4 border-[#e5e5e5] bg-white shadow-xs overflow-hidden">
      {/* Header gọn gàng của Card */}
      <div className="border-b border-[#f0f0f0] bg-[#fafafa]/80 p-3.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Badge variant="blue" className="text-[11px] py-0.5 shrink-0">
              <Sparkles className="size-3 mr-1" /> Phân tích câu
            </Badge>
            {isEnriching && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#bfe9fd] bg-[#e5f6fd] px-2 py-0.5 text-[10.5px] font-bold text-[#087db4] animate-pulse shrink-0">
                <Loader2 className="size-3 animate-spin text-[#1cb0f6]" />
                <span>AI đang mổ xẻ ngữ pháp...</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => playSentenceAudio(data.sentence)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-[#1cb0f6] hover:bg-[#e5f6fd] transition-colors"
              title="Nghe phát âm cả câu"
            >
              <Volume2 className="size-3.5" />
              <span className="hidden sm:inline">Nghe</span>
            </button>

            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="flex size-7 items-center justify-center rounded-lg text-ash hover:bg-gray-200 hover:text-charcoal transition-colors"
                title="Phân tích lại câu này"
              >
                <RefreshCw className="size-3.5" />
              </button>
            )}

            {onClosePanel && (
              <button
                type="button"
                onClick={onClosePanel}
                className="flex size-7 items-center justify-center rounded-lg text-ash hover:bg-gray-200 hover:text-charcoal transition-colors"
                title="Thu gọn bảng phân tích (Zen Mode)"
              >
                <PanelRightClose className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Trích dẫn câu đang chọn */}
        <p className="mt-2 text-xs font-semibold italic text-charcoal leading-relaxed line-clamp-3">
          &ldquo;{data.sentence}&rdquo;
        </p>

        {/* Thông báo nhẹ nếu có lỗi phân tích chuyên sâu nhưng bản dịch vẫn còn */}
        {error && (
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-[#ffe0e6] bg-[#fff5f7] p-2 text-xs font-bold text-[#c92a2a]">
            <span>⚠️ {error} (Bản dịch vẫn sẵn sàng)</span>
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

      {/* Thanh chuyển đổi Tab (Tab Navigation Bar) */}
      <div className="flex border-b border-[#f0f0f0] bg-white px-3 pt-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("meaning")}
          className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-xs font-black transition-all ${
            activeTab === "meaning"
              ? "border-[#1cb0f6] text-[#1cb0f6]"
              : "border-transparent text-ash hover:text-charcoal"
          }`}
        >
          <Languages className="size-3.5" />
          <span>Ngữ nghĩa</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("grammar")}
          className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-xs font-black transition-all ${
            activeTab === "grammar"
              ? "border-[#1cb0f6] text-[#1cb0f6]"
              : "border-transparent text-ash hover:text-charcoal"
          }`}
        >
          <Layers className="size-3.5" />
          <span>Ngữ pháp</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("vocab")}
          className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-xs font-black transition-all ${
            activeTab === "vocab"
              ? "border-[#1cb0f6] text-[#1cb0f6]"
              : "border-transparent text-ash hover:text-charcoal"
          }`}
        >
          <BookMarked className="size-3.5" />
          <span>Từ vựng</span>
          {vocabCount > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeTab === "vocab"
                  ? "bg-[#e5f6fd] text-[#0284c7]"
                  : "bg-gray-100 text-ash"
              }`}
            >
              {vocabCount}
            </span>
          )}
        </button>
      </div>

      {/* Nội dung Tab */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {/* TAB 1: NGỮ NGHĨA */}
        {activeTab === "meaning" && (
          <div className="space-y-3">
            {/* Bản dịch tiếng Việt rõ nét */}
            <div className="rounded-xl border border-[#d2f4a6] bg-[#f9fdf5] p-3.5">
              <span className="block mb-1 text-[11px] font-black uppercase tracking-wider text-[#438f0e]">
                🇻🇳 Bản dịch ngữ cảnh
              </span>
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
            </div>

            {/* Audio phát âm */}
            <div className="flex items-center justify-between rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3">
              <div className="flex items-center gap-2">
                <Volume2 className="size-4 text-[#1cb0f6]" />
                <span className="text-xs font-bold text-eel-dark-blue">
                  Phát âm chuẩn bản xứ (US)
                </span>
              </div>
              <button
                type="button"
                onClick={() => playSentenceAudio(data.sentence)}
                className="rounded-lg border border-[#bfe9fd] bg-[#f0f9ff] px-2.5 py-1 text-xs font-black text-[#1cb0f6] hover:bg-[#e0f2fe] transition-colors cursor-pointer"
              >
                Phát âm
              </button>
            </div>

            {/* Diễn đạt đơn giản hơn (Simplified English) */}
            {data.simplifiedEnglish ? (
              <div className="rounded-xl border border-[#e0f2fe] bg-[#f8fafc] p-3.5">
                <span className="block mb-1 text-[11px] font-black uppercase tracking-wider text-[#0284c7]">
                  💡 Diễn đạt đơn giản hơn (A2/B1)
                </span>
                <p className="text-xs md:text-sm font-semibold italic text-charcoal leading-relaxed">
                  &ldquo;{data.simplifiedEnglish}&rdquo;
                </p>
              </div>
            ) : isEnriching ? (
              <div className="rounded-xl border border-dashed border-[#e0f2fe] bg-[#f8fafc]/50 p-3 text-xs text-ash flex items-center gap-2">
                <Loader2 className="size-3 animate-spin text-[#1cb0f6]" />
                <span>AI đang tạo diễn đạt đơn giản hơn...</span>
              </div>
            ) : null}
          </div>
        )}

        {/* TAB 2: NGỮ PHÁP */}
        {activeTab === "grammar" && (
          <div className="space-y-3">
            {(!data.grammar?.clauses || data.grammar.clauses.length === 0) && isEnriching ? (
              <div className="rounded-xl border border-[#bfe9fd] bg-[#f0f9ff] p-5 text-center space-y-2">
                <Loader2 className="mx-auto size-5 animate-spin text-[#1cb0f6]" />
                <h4 className="text-xs font-black text-eel-dark-blue">
                  AI đang mổ xẻ cấu trúc ngữ pháp và mệnh đề S-V-O...
                </h4>
                <p className="text-[11px] text-ash">
                  Bản dịch ngữ nghĩa và phát âm câu đã sẵn sàng ở tab Ngữ nghĩa.
                </p>
              </div>
            ) : (
              <>
                {/* Cấu trúc / Pattern */}
                <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="size-4 text-[#1cb0f6]" />
                    <h4 className="text-xs font-black text-eel-dark-blue uppercase tracking-wider">
                      Cấu trúc: {data.grammar?.pattern || "Phân tích câu"}
                    </h4>
                  </div>
                  {data.grammar?.explanation && (
                    <p className="text-xs font-medium text-charcoal leading-relaxed mt-1">
                      {data.grammar.explanation}
                    </p>
                  )}
                </div>

                {/* Bóc tách mệnh đề (Clauses) dạng chip thanh thoát */}
                {data.grammar?.clauses && data.grammar.clauses.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-[11px] font-black uppercase tracking-wider text-ash">
                      Bóc tách mệnh đề ({data.grammar.clauses.length})
                    </h5>
                    {data.grammar.clauses.map((clause, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-[#e5e5e5] bg-white p-3 space-y-1.5"
                      >
                        <div className="text-[11px] font-extrabold uppercase text-[#1cb0f6]">
                          {clause.role}
                        </div>
                        <div className="font-mono text-xs text-charcoal italic">
                          &ldquo;{clause.clauseText}&rdquo;
                        </div>

                        {/* Chips thanh thoát cho S, V, O/C */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800 border border-blue-100">
                            <strong className="font-bold text-blue-900">S:</strong> {clause.subject}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 border border-amber-100">
                            <strong className="font-bold text-amber-900">V:</strong> {clause.verb}
                          </span>
                          {clause.objectOrComplement && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-800 border border-purple-100">
                              <strong className="font-bold text-purple-900">O/C:</strong> {clause.objectOrComplement}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 3: TỪ VỰNG & CỤM TỪ */}
        {activeTab === "vocab" && (
          <div className="space-y-4">
            {vocabCount === 0 && isEnriching ? (
              <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-5 text-center space-y-2">
                <Loader2 className="mx-auto size-5 animate-spin text-[#1cb0f6]" />
                <p className="text-xs font-black text-eel-dark-blue">
                  Đang bóc tách danh sách từ vựng &amp; IPA theo ngữ cảnh...
                </p>
              </div>
            ) : (
              <>
                {/* Thanh tiêu đề từ vựng & Nút Lưu tất cả */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black uppercase tracking-wider text-eel-dark-blue">
                      Từ vựng trọng tâm
                    </span>
                    <span className="rounded-full bg-[#e0f2fe] px-2 py-0.2 text-[11px] font-black text-[#0369a1]">
                      {vocabCount}
                    </span>
                  </div>

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

                {/* Danh sách từ vựng */}
                {vocabCount === 0 ? (
                  <div className="py-8 text-center text-xs text-ash">
                    Không có từ vựng đặc biệt nào cần chú thích trong câu này.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {data.vocabulary?.map((item, idx) => {
                      const isSaved = savedWords[item.term];
                      const isSaving = savingWord === item.term;

                      return (
                        <div
                          key={idx}
                          className="group relative rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3 transition-colors hover:border-[#bfe9fd] hover:bg-white"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-sm text-eel-dark-blue">
                                  {item.term}
                                </span>
                                {item.ipa && (
                                  <span className="font-mono text-xs text-ash">
                                    {item.ipa}
                                  </span>
                                )}
                                <span className="rounded bg-gray-100 px-1.5 py-0.2 text-[10px] font-bold text-charcoal">
                                  {item.partOfSpeech}
                                </span>
                                {item.cefr && (
                                  <span className="rounded bg-[#e5f6fd] px-1.5 py-0.2 text-[10px] font-black text-[#087db4]">
                                    {item.cefr}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1.5 text-xs font-bold text-[#438f0e]">
                                🇻🇳 {item.contextMeaningVi}
                              </p>
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

                {/* Cụm từ và Thành ngữ (Idioms & Phrasal Verbs) nếu có */}
                {idiomsCount > 0 && (
                  <div className="pt-2 border-t border-[#eeeeee] space-y-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-ash block">
                      Cụm từ &amp; Thành ngữ ({idiomsCount})
                    </span>
                    <div className="space-y-2">
                      {data.idiomsAndPhrases?.map((item, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-[#e5f6fd] bg-[#f0f9ff] p-2.5 text-xs"
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
