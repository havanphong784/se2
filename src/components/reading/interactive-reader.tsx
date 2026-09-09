"use client";

import React, { useState, useRef } from "react";
import { Eye, EyeOff, Check } from "lucide-react";
import { POS_STYLES } from "@/lib/reading/pos-tagger";
import { WordPopover, type WordPopoverData } from "./word-popover";
import type { POSTag, SentenceItem } from "@/types/reading";

interface InteractiveReaderProps {
  paragraphs: Array<{
    id: string;
    index: number;
    sentences: SentenceItem[];
  }>;
  activeSentenceId: string | null;
  onSelectSentence: (sentence: SentenceItem) => void;
  onSaveWordToDeck?: (word: string, translation: string, phonetic: string) => Promise<void>;
  contextVocabMap?: Record<string, { meaning: string; ipa: string }>;
}

export function InteractiveReader({
  paragraphs,
  activeSentenceId,
  onSelectSentence,
  onSaveWordToDeck,
  contextVocabMap,
}: InteractiveReaderProps) {
  // Bộ lọc bật/tắt hiển thị màu từ loại
  const [showPosColors, setShowPosColors] = useState(true);
  const [enabledTags, setEnabledTags] = useState<Record<POSTag, boolean>>({
    noun: true,
    verb: true,
    adjective: true,
    adverb: true,
    pronoun: true,
    preposition: false, // Mặc định tắt các từ phụ để không rối mắt
    conjunction: false,
    determiner: false,
    other: false,
  });

  // State cho hover Popover
  const [popoverData, setPopoverData] = useState<WordPopoverData | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const toggleTag = (tag: POSTag) => {
    setEnabledTags((prev) => ({ ...prev, [tag]: !prev[tag] }));
  };

  const handleWordMouseEnter = (
    e: React.MouseEvent<HTMLSpanElement>,
    cleanWord: string,
    rawText: string,
    pos: POSTag
  ) => {
    if (!cleanWord) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);

    const target = e.currentTarget;
    hoverTimeoutRef.current = setTimeout(() => {
      const rect = target.getBoundingClientRect();
      const mapped = contextVocabMap ? contextVocabMap[cleanWord.toLowerCase()] : undefined;

      setPopoverData({
        word: rawText.trim(),
        cleanWord,
        pos,
        rect,
        contextMeaning: mapped?.meaning,
        ipa: mapped?.ipa,
      });
    }, 180);
  };

  const handleWordMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setPopoverData(null);
    }, 250);
  };

  return (
    <div className="relative flex flex-col h-full">
      {/* Thanh điều khiển hiển thị từ loại (POS Filters) */}
      <div className="mb-4 rounded-xl border-2 border-[#e5e5e5] bg-[#fafafa] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eeeeee] pb-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-eel-dark-blue">Nhận diện Từ loại (POS):</span>
            <button
              onClick={() => setShowPosColors(!showPosColors)}
              className="flex items-center gap-1 text-[11px] font-bold text-[#1cb0f6] hover:underline"
            >
              {showPosColors ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {showPosColors ? "Tắt màu" : "Bật màu tất cả"}
            </button>
          </div>
          <span className="text-[11px] font-bold text-ash">
            💡 Click vào câu để AI mổ xẻ ngữ pháp &amp; dịch nghĩa
          </span>
        </div>

        {/* Danh sách các thẻ từ loại */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              "noun",
              "verb",
              "adjective",
              "adverb",
              "pronoun",
              "preposition",
              "conjunction",
              "determiner",
            ] as POSTag[]
          ).map((tag) => {
            const isEnabled = showPosColors && enabledTags[tag];
            const def = POS_STYLES[tag];
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold transition-all ${
                  isEnabled
                    ? `${def.bgBadge} border-current shadow-2xs`
                    : "border-[#e5e5e5] bg-white text-ash opacity-60"
                }`}
              >
                <span
                  className="size-2 rounded-full inline-block"
                  style={{ backgroundColor: def.textColor }}
                />
                <span>{def.labelVi}</span>
                {isEnabled && <Check className="size-3 stroke-[3]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Nội dung tài liệu hiển thị dạng Interactive Sentences */}
      <div
        className="flex-1 overflow-y-auto rounded-xl border-2 border-[#e5e5e5] bg-white p-5 md:p-7 leading-relaxed space-y-5"
        onClick={() => setPopoverData(null)}
      >
        {paragraphs.map((para) => (
          <p key={para.id} className="text-base text-charcoal font-medium leading-8">
            {para.sentences.map((sentence) => {
              const isActive = sentence.id === activeSentenceId;

              return (
                <span
                  key={sentence.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSentence(sentence);
                  }}
                  className={`inline rounded-lg px-1.5 py-0.5 cursor-pointer transition-all duration-150 ${
                    isActive
                      ? "bg-[#e5f6fd] outline outline-2 outline-[#1cb0f6] text-black font-semibold"
                      : "hover:bg-[#f5fbf0] hover:outline hover:outline-1 hover:outline-[#a5ed6e]"
                  }`}
                  title="Click để phân tích câu này"
                >
                  {sentence.tokens.map((token, tIdx) => {
                    const shouldColor =
                      showPosColors && enabledTags[token.pos] && token.isWord;
                    const style = POS_STYLES[token.pos] || POS_STYLES.other;

                    if (!token.isWord) {
                      return <span key={tIdx}>{token.text}</span>;
                    }

                    return (
                      <span
                        key={tIdx}
                        onMouseEnter={(e) =>
                          handleWordMouseEnter(e, token.cleanText, token.text, token.pos)
                        }
                        onMouseLeave={handleWordMouseLeave}
                        className={`inline-block rounded-xs px-0.5 transition-colors cursor-help ${
                          shouldColor ? style.twTextClass : "text-inherit"
                        } hover:bg-[#fff9d2] hover:text-black`}
                      >
                        {token.text}
                      </span>
                    );
                  })}
                </span>
              );
            })}
          </p>
        ))}
      </div>

      {/* Word Popover khi hover */}
      <WordPopover
        data={popoverData}
        onClose={() => setPopoverData(null)}
        onSaveToDeck={onSaveWordToDeck}
      />
    </div>
  );
}
