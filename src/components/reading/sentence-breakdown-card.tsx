"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SentenceBreakdownResponse, ContextualVocab } from "@/types/reading";

interface SentenceBreakdownCardProps {
  data: SentenceBreakdownResponse | null;
  isLoading: boolean;
  error: string | null;
  selectedSentenceText: string | null;
  onRetry?: () => void;
  onOpenAIConfig: () => void;
  onSaveWordToDeck?: (word: string, translation: string, phonetic: string) => Promise<void>;
}

export function SentenceBreakdownCard({
  data,
  isLoading,
  error,
  selectedSentenceText,
  onRetry,
  onOpenAIConfig,
  onSaveWordToDeck,
}: SentenceBreakdownCardProps) {
  const [savedWords, setSavedWords] = useState<Record<string, boolean>>({});
  const [savingWord, setSavingWord] = useState<string | null>(null);

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

  const playSentenceAudio = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "en-US";
      utter.rate = 0.95;
      window.speechSynthesis.speak(utter);
    }
  };

  // 1. Trạng thái chưa chọn câu
  if (!selectedSentenceText) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d9d9d9] bg-[#fafafa] p-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl border-2 border-b-4 border-[#bfe9fd] bg-[#f0f9ff] text-[#1cb0f6]">
          <BookOpen className="size-7" />
        </div>
        <h3 className="mt-4 text-base font-black text-eel-dark-blue">
          Chọn một câu trong bài đọc
        </h3>
        <p className="mt-1.5 max-w-sm text-xs font-semibold leading-relaxed text-ash">
          Click vào bất kỳ câu hoặc dòng văn bản ở cột bên trái để AI tiến hành mổ xẻ ngữ pháp,
          dịch nghĩa và bóc tách từ vựng chuyên sâu.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenAIConfig}
          className="mt-5 gap-1.5 font-bold"
        >
          <Sparkles className="size-4" /> Cài đặt Local AI Endpoint
        </Button>
      </div>
    );
  }

  // 2. Trạng thái đang tải (Loading Skeleton)
  if (isLoading) {
    return (
      <div className="flex h-full flex-col space-y-4 rounded-xl border-2 border-[#e5e5e5] bg-white p-5 overflow-y-auto">
        <div className="flex items-center gap-3 border-b border-[#f0f0f0] pb-3">
          <Loader2 className="size-5 animate-spin text-[#1cb0f6]" />
          <div className="text-xs font-bold text-eel-dark-blue">
            <span>Local AI đang phân tích câu...</span>
            <span className="block text-[11px] font-normal text-ash">
              Đang mổ xẻ cấu trúc ngữ pháp và từ vựng theo ngữ cảnh
            </span>
          </div>
        </div>

        {/* Shimmer items */}
        <div className="space-y-3 animate-pulse">
          <div className="h-16 rounded-xl bg-gray-100" />
          <div className="h-28 rounded-xl bg-gray-100" />
          <div className="h-40 rounded-xl bg-gray-100" />
        </div>
      </div>
    );
  }

  // 3. Trạng thái lỗi
  if (error || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border-2 border-[#ffccd5] bg-[#fff8f8] p-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-[#ffe4e6] text-[#e11d48]">
          <HelpCircle className="size-6" />
        </div>
        <h3 className="mt-3 text-sm font-black text-[#be123c]">
          Không thể phân tích câu này
        </h3>
        <p className="mt-1 text-xs text-ash max-w-md">
          {error || "Mô hình AI không phản hồi hoặc endpoint bị gián đoạn."}
        </p>

        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry} className="gap-1.5 font-bold">
              <RefreshCw className="size-4" /> Thử lại
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onOpenAIConfig} className="gap-1.5 font-bold">
            <Sparkles className="size-4" /> Kiểm tra cấu hình AI
          </Button>
        </div>
      </div>
    );
  }

  // 4. Render kết quả chi tiết
  return (
    <div className="flex h-full flex-col space-y-4 overflow-y-auto pr-1">
      {/* Khối 1: Câu gốc + Dịch nghĩa + Viết lại đơn giản */}
      <div className="rounded-xl border-2 border-b-4 border-[#e5e5e5] bg-white p-4">
        <div className="flex items-start justify-between gap-2 border-b border-[#f0f0f0] pb-2.5">
          <div className="flex items-center gap-1.5">
            <Badge variant="blue" className="text-[11px]">
              Phân tích câu
            </Badge>
          </div>
          <button
            onClick={() => playSentenceAudio(data.sentence)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-[#1cb0f6] hover:bg-[#e5f6fd] transition-colors"
            title="Nghe phát âm cả câu"
          >
            <Volume2 className="size-4" /> <span>Nghe</span>
          </button>
        </div>

        {/* Trích dẫn câu tiếng Anh */}
        <div className="mt-3 font-semibold text-charcoal text-sm italic">
          &ldquo;{data.sentence}&rdquo;
        </div>

        {/* Bản dịch tiếng Việt */}
        <div className="mt-3 rounded-xl border border-[#e5e5e5] bg-[#f9fdf5] p-3">
          <span className="text-[11px] font-black text-[#438f0e] block mb-0.5">
            🇻🇳 Bản dịch ngữ cảnh:
          </span>
          <p className="text-sm font-extrabold text-eel-dark-blue leading-relaxed">
            {data.translationVi}
          </p>
        </div>

        {/* Simplified English */}
        {data.simplifiedEnglish && (
          <div className="mt-2.5 rounded-xl border border-[#e5e5e5] bg-[#f8fafc] p-3 text-xs">
            <span className="font-black text-[#0284c7] block mb-0.5">
              💡 Cách diễn đạt đơn giản hơn (A2/B1):
            </span>
            <span className="font-semibold text-charcoal italic">
              &ldquo;{data.simplifiedEnglish}&rdquo;
            </span>
          </div>
        )}
      </div>

      {/* Khối 2: Mổ xẻ Cấu trúc Ngữ pháp (Grammar Anatomy) */}
      <div className="rounded-xl border-2 border-b-4 border-[#e5e5e5] bg-white p-4">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="size-4 text-[#1cb0f6]" />
          <h4 className="text-xs font-black text-eel-dark-blue uppercase tracking-wider">
            Cấu trúc Ngữ pháp: {data.grammar?.pattern || "Phân tích câu"}
          </h4>
        </div>

        {data.grammar?.explanation && (
          <p className="text-xs leading-relaxed text-charcoal font-medium">
            {data.grammar.explanation}
          </p>
        )}

        {/* Phân tách từng mệnh đề (Clauses) */}
        {data.grammar?.clauses && data.grammar.clauses.length > 0 && (
          <div className="mt-3 space-y-2">
            {data.grammar.clauses.map((clause, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-2.5 text-xs"
              >
                <div className="font-bold text-[#1cb0f6] text-[11px] uppercase">
                  {clause.role}
                </div>
                <div className="my-1.5 font-mono text-[11.5px] text-charcoal">
                  &ldquo;{clause.clauseText}&rdquo;
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1 text-[11px]">
                  <span className="rounded border border-[#e5e5e5] bg-white px-2 py-0.5 font-medium text-ash">
                    <strong className="text-eel-dark-blue">S:</strong> {clause.subject}
                  </span>
                  <span className="rounded border border-[#e5e5e5] bg-white px-2 py-0.5 font-medium text-ash">
                    <strong className="text-[#ea580c]">V:</strong> {clause.verb}
                  </span>
                  {clause.objectOrComplement && (
                    <span className="rounded border border-[#e5e5e5] bg-white px-2 py-0.5 font-medium text-ash">
                      <strong className="text-[#9333ea]">O/C:</strong>{" "}
                      {clause.objectOrComplement}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Khối 3: Từ vựng trọng tâm trong câu */}
      {data.vocabulary && data.vocabulary.length > 0 && (
        <div className="rounded-xl border-2 border-b-4 border-[#e5e5e5] bg-white p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h4 className="text-xs font-black text-eel-dark-blue uppercase tracking-wider">
              📚 Từ vựng trọng tâm ({data.vocabulary.length})
            </h4>
            <span className="text-[11px] font-bold text-ash">
              Lưu trực tiếp vào bộ từ ôn tập
            </span>
          </div>

          <div className="space-y-2.5">
            {data.vocabulary.map((vocab, i) => {
              const isSaved = savedWords[vocab.term];
              const isSaving = savingWord === vocab.term;

              return (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-lg border border-[#f0f0f0] p-2.5 transition-colors hover:bg-[#fafafa]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-extrabold text-sm text-eel-dark-blue">
                        {vocab.term}
                      </span>
                      {vocab.ipa && (
                        <span className="font-mono text-xs text-ash">{vocab.ipa}</span>
                      )}
                      {vocab.partOfSpeech && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.2 text-[10px] font-bold text-ash">
                          {vocab.partOfSpeech}
                        </span>
                      )}
                      {vocab.cefr && (
                        <span className="rounded bg-[#e0f2fe] px-1.5 py-0.2 text-[10px] font-black text-[#0369a1]">
                          {vocab.cefr}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-charcoal">
                      👉 {vocab.contextMeaningVi}
                    </div>
                  </div>

                  {onSaveWordToDeck && (
                    <button
                      onClick={() => handleSaveWord(vocab)}
                      disabled={isSaving || isSaved}
                      className={`flex shrink-0 items-center gap-1 rounded-lg border-2 px-2.5 py-1 text-xs font-black transition-all ${
                        isSaved
                          ? "border-[#a5ed6e] bg-[#f7fff1] text-[#438f0e]"
                          : "border-[#46a302] border-b-3 bg-ecto-green text-white hover:bg-[#51bd02] active:translate-y-0.5"
                      }`}
                    >
                      {isSaving ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : isSaved ? (
                        <>
                          <Check className="size-3.5" /> Đã lưu
                        </>
                      ) : (
                        <>
                          <Plus className="size-3.5" /> Lưu
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Khối 4: Idioms & Collocations nếu có */}
      {data.idiomsAndPhrases && data.idiomsAndPhrases.length > 0 && (
        <div className="rounded-xl border-2 border-b-4 border-[#e5e5e5] bg-white p-4">
          <h4 className="text-xs font-black text-eel-dark-blue uppercase tracking-wider mb-2.5">
            🎯 Cụm từ &amp; Thành ngữ
          </h4>
          <div className="space-y-2">
            {data.idiomsAndPhrases.map((item, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-2.5 text-xs"
              >
                <div className="font-extrabold text-eel-dark-blue text-sm">
                  &ldquo;{item.phrase}&rdquo;
                </div>
                <div className="mt-0.5 font-medium text-charcoal">
                  👉 {item.meaningVi}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
