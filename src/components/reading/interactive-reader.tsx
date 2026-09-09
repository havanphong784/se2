"use client";

import React, { useState, useRef, useMemo } from "react";
import {
  Check,
  Sparkles,
  Minus,
  Plus,
  Quote,
} from "lucide-react";
import { POS_STYLES } from "@/lib/reading/pos-tagger";
import { WordPopover, type WordPopoverData } from "./word-popover";
import { detectPhrasesInSentence } from "@/lib/reading/phrase-matcher";
import type {
  POSTag,
  SentenceItem,
  ParagraphBlock,
  IdiomPhrase,
  DetectedPhrase,
} from "@/types/reading";

type HighlightMode = "focus" | "underline" | "full" | "none";
type FontSize = "sm" | "base" | "lg" | "xl";
type FontFamily = "sans" | "serif";

interface InteractiveReaderProps {
  paragraphs: ParagraphBlock[];
  activeSentenceId: string | null;
  onSelectSentence: (sentence: SentenceItem) => void;
  onSaveWordToDeck?: (word: string, translation: string, phonetic: string) => Promise<void>;
  contextVocabMap?: Record<string, { meaning: string; ipa: string }>;
  aiPhrases?: IdiomPhrase[];
}

export function InteractiveReader({
  paragraphs,
  activeSentenceId,
  onSelectSentence,
  onSaveWordToDeck,
  contextVocabMap,
  aiPhrases,
}: InteractiveReaderProps) {
  // Chế độ highlight: "focus" (chỉ câu đang chọn) là mặc định chống rối mắt
  const [highlightMode, setHighlightMode] = useState<HighlightMode>("focus");

  // Bộ lọc từ loại
  const [enabledTags, setEnabledTags] = useState<Record<POSTag, boolean>>({
    noun: true,
    verb: true,
    adjective: true,
    adverb: true,
    pronoun: true,
    preposition: false,
    conjunction: false,
    determiner: false,
    other: false,
  });

  // Tùy chỉnh công thái học hiển thị (Typography)
  const [fontSize, setFontSize] = useState<FontSize>("base");
  const [fontFamily, setFontFamily] = useState<FontFamily>("sans");

  // Cụm từ đang được hover để gom sáng toàn bộ các từ trong cụm
  const [hoveredPhraseId, setHoveredPhraseId] = useState<string | null>(null);

  // State cho hover Popover
  const [popoverData, setPopoverData] = useState<WordPopoverData | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Nhận diện và lập bản đồ cụm từ cho tất cả các câu trong tài liệu
  const sentencePhrasesMap = useMemo(() => {
    const map = new Map<
      string,
      {
        phrases: DetectedPhrase[];
        tokenToPhraseMap: Map<number, DetectedPhrase>;
      }
    >();

    for (const block of paragraphs) {
      for (const sent of block.sentences) {
        // Chỉ truyền aiPhrases vào câu đang active
        const relevantAiPhrases = sent.id === activeSentenceId ? aiPhrases : undefined;
        const res = detectPhrasesInSentence(sent.text, sent.tokens, relevantAiPhrases);
        map.set(sent.id, res);
      }
    }

    return map;
  }, [paragraphs, activeSentenceId, aiPhrases]);

  const toggleTag = (tag: POSTag) => {
    setEnabledTags((prev) => ({ ...prev, [tag]: !prev[tag] }));
  };

  const increaseFontSize = () => {
    if (fontSize === "sm") setFontSize("base");
    else if (fontSize === "base") setFontSize("lg");
    else if (fontSize === "lg") setFontSize("xl");
  };

  const decreaseFontSize = () => {
    if (fontSize === "xl") setFontSize("lg");
    else if (fontSize === "lg") setFontSize("base");
    else if (fontSize === "base") setFontSize("sm");
  };

  const handleWordMouseEnter = (
    e: React.MouseEvent<HTMLSpanElement>,
    cleanWord: string,
    rawText: string,
    pos: POSTag,
    phrase?: DetectedPhrase
  ) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);

    const target = e.currentTarget;

    // Nếu từ này thuộc 1 cụm từ -> gom sáng cả cụm
    if (phrase) {
      setHoveredPhraseId(phrase.id);
      hoverTimeoutRef.current = setTimeout(() => {
        const rect = target.getBoundingClientRect();
        setPopoverData({
          word: phrase.phraseText,
          cleanWord: phrase.cleanPhrase,
          pos: "other",
          rect,
          contextMeaning: phrase.meaningVi,
          isPhrase: true,
          phraseType: phrase.type,
          subWords: phrase.subWords,
        });
      }, 70);
    } else {
      setHoveredPhraseId(null);
      if (!cleanWord) return;

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
          isPhrase: false,
        });
      }, 70);
    }
  };

  const handleWordMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredPhraseId(null);
      setPopoverData(null);
    }, 160);
  };

  // Tính năng Bôi đen tra nhanh (Select-to-Lookup)
  const handleMouseUp = () => {
    if (typeof window === "undefined") return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().trim();
    const wordCount = selectedText.split(/\s+/).length;

    // Chỉ kích hoạt khi bôi đen từ 2 đến 12 từ
    if (wordCount >= 2 && selectedText.length >= 3 && selectedText.length <= 120) {
      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setPopoverData({
            word: selectedText,
            cleanWord: selectedText.toLowerCase(),
            pos: "other",
            rect,
            isPhrase: true,
            phraseType: "selection",
          });
        }
      } catch {
        // ignore
      }
    }
  };

  // Kích thước font chữ
  const fontSizeClasses: Record<FontSize, string> = {
    sm: "text-sm leading-7",
    base: "text-[16px] leading-8",
    lg: "text-[18px] leading-9",
    xl: "text-[20px] leading-10",
  };

  return (
    <div className="relative flex flex-col h-full">
      {/* Thanh điều khiển Typography & Chế độ hiển thị (Reading Toolbar) */}
      <div className="mb-3 rounded-2xl border-2 border-[#e5e5e5] bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0f0f0] pb-2.5 mb-2.5">
          {/* Chọn chế độ Highlight */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-eel-dark-blue mr-1">Tô màu từ:</span>
            <div className="flex items-center rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setHighlightMode("focus")}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  highlightMode === "focus"
                    ? "bg-[#e5f6fd] text-[#1cb0f6] shadow-2xs"
                    : "text-ash hover:text-charcoal"
                }`}
                title="Chỉ tô màu câu đang được chọn để trang đọc thoáng đãng, dễ tập trung"
              >
                <Sparkles className="size-3.5 inline mr-1" /> Câu đang chọn
              </button>
              <button
                type="button"
                onClick={() => setHighlightMode("underline")}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  highlightMode === "underline"
                    ? "bg-[#f3e8ff] text-[#9333ea] shadow-2xs"
                    : "text-ash hover:text-charcoal"
                }`}
                title="Chữ đen, gạch chân viền màu từ loại bên dưới"
              >
                Gạch chân
              </button>
              <button
                type="button"
                onClick={() => setHighlightMode("full")}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  highlightMode === "full"
                    ? "bg-[#fef3c7] text-[#b45309] shadow-2xs"
                    : "text-ash hover:text-charcoal"
                }`}
                title="Tô màu toàn bộ từ trong cả văn bản"
              >
                Toàn bộ
              </button>
              <button
                type="button"
                onClick={() => setHighlightMode("none")}
                className={`rounded-lg px-2 py-1 transition-all ${
                  highlightMode === "none"
                    ? "bg-gray-200 text-charcoal shadow-2xs"
                    : "text-ash hover:text-charcoal"
                }`}
                title="Tắt màu"
              >
                Tắt
              </button>
            </div>
          </div>

          {/* Công cụ công thái học: Cỡ chữ (A-/A+) & Font Family */}
          <div className="flex items-center gap-2">
            {/* Font switcher */}
            <div className="flex items-center rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setFontFamily("sans")}
                className={`rounded-lg px-2 py-0.5 transition-all ${
                  fontFamily === "sans"
                    ? "bg-white text-eel-dark-blue shadow-2xs"
                    : "text-ash"
                }`}
              >
                Sans
              </button>
              <button
                type="button"
                onClick={() => setFontFamily("serif")}
                className={`rounded-lg px-2 py-0.5 font-serif transition-all ${
                  fontFamily === "serif"
                    ? "bg-white text-eel-dark-blue shadow-2xs"
                    : "text-ash"
                }`}
              >
                Serif
              </button>
            </div>

            {/* Font size buttons */}
            <div className="flex items-center rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={decreaseFontSize}
                disabled={fontSize === "sm"}
                className="rounded-lg p-1 text-ash hover:text-charcoal disabled:opacity-40"
                title="Giảm cỡ chữ"
              >
                <Minus className="size-3.5" />
              </button>
              <span className="px-2 text-xs font-mono font-black text-charcoal">
                {fontSize.toUpperCase()}
              </span>
              <button
                type="button"
                onClick={increaseFontSize}
                disabled={fontSize === "xl"}
                className="rounded-lg p-1 text-ash hover:text-charcoal disabled:opacity-40"
                title="Tăng cỡ chữ"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Thanh filter các loại từ loại */}
        {highlightMode !== "none" && (
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
              const isEnabled = enabledTags[tag];
              const def = POS_STYLES[tag];
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold transition-all ${
                    isEnabled
                      ? `${def.bgBadge} border-current shadow-2xs`
                      : "border-[#e5e5e5] bg-white text-ash opacity-50"
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
        )}
      </div>

      {/* Khung đọc tài liệu gốc (Document Flow Area) */}
      <div
        onMouseUp={handleMouseUp}
        className={`flex-1 overflow-y-auto rounded-2xl border-2 border-[#e5e5e5] bg-white p-6 md:p-8 space-y-6 select-text ${
          fontFamily === "serif" ? "font-serif" : "font-sans"
        }`}
        onClick={() => {
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed) {
            setPopoverData(null);
          }
        }}
      >
        {paragraphs.map((block) => {
          // Render theo loại Semantic Block
          if (block.type === "heading") {
            const HeadingTag =
              block.headingLevel === 1 ? "h2" : block.headingLevel === 2 ? "h3" : "h4";
            const headingClasses =
              block.headingLevel === 1
                ? "text-2xl font-black text-eel-dark-blue border-b-2 border-[#eeeeee] pb-2 mt-6 mb-3 tracking-tight"
                : block.headingLevel === 2
                ? "text-xl font-extrabold text-eel-dark-blue mt-5 mb-2"
                : "text-lg font-bold text-eel-dark-blue mt-4 mb-2";

            return (
              <HeadingTag key={block.id} className={headingClasses}>
                {block.sentences.map((sent) => (
                  <span
                    key={sent.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSentence(sent);
                    }}
                    className="cursor-pointer hover:text-[#1cb0f6] transition-colors"
                  >
                    {sent.text}
                  </span>
                ))}
              </HeadingTag>
            );
          }

          if (block.type === "quote") {
            return (
              <blockquote
                key={block.id}
                className="border-l-4 border-[#58cc02] bg-[#f9fdf5] pl-4 py-2.5 my-3 italic rounded-r-xl"
              >
                <div className="flex items-start gap-2">
                  <Quote className="size-4 text-[#58cc02] shrink-0 mt-1" />
                  <div className={`${fontSizeClasses[fontSize]} text-charcoal`}>
                    {renderSentenceList(block.sentences)}
                  </div>
                </div>
              </blockquote>
            );
          }

          if (block.type === "list_item") {
            return (
              <div
                key={block.id}
                className={`flex items-start gap-2.5 pl-3 ${fontSizeClasses[fontSize]} text-charcoal`}
              >
                <span className="select-none text-[#1cb0f6] font-black mt-0.5">•</span>
                <div className="flex-1">{renderSentenceList(block.sentences)}</div>
              </div>
            );
          }

          // Đoạn văn Paragraph chuẩn
          return (
            <div
              key={block.id}
              className={`relative ${fontSizeClasses[fontSize]} text-[#2c2c2c]`}
            >
              {renderSentenceList(block.sentences)}
            </div>
          );
        })}
      </div>

      {/* Word / Phrase Popover */}
      <WordPopover
        data={popoverData}
        onClose={() => setPopoverData(null)}
        onSaveToDeck={onSaveWordToDeck}
      />
    </div>
  );

  function renderSentenceList(sentences: SentenceItem[]) {
    return sentences.map((sentence) => {
      const isActive = sentence.id === activeSentenceId;
      const phraseData = sentencePhrasesMap.get(sentence.id);
      const tokenMap = phraseData?.tokenToPhraseMap;

      // Xác định câu này có được bật màu POS không
      const isSentenceHighlighted =
        highlightMode === "full" ||
        highlightMode === "underline" ||
        (highlightMode === "focus" && isActive);

      return (
        <span
          key={sentence.id}
          onClick={(e) => {
            e.stopPropagation();
            onSelectSentence(sentence);
          }}
          className={`inline rounded-lg px-1.5 py-0.5 cursor-pointer transition-all duration-150 ${
            isActive
              ? "bg-[#e5f6fd] outline outline-2 outline-[#1cb0f6] text-black font-semibold shadow-2xs"
              : "hover:bg-[#f2f9ff] hover:outline hover:outline-1 hover:outline-[#bfe9fd]"
          }`}
          title="Click để phân tích câu này"
        >
          {sentence.tokens.map((token, tIdx) => {
            if (!token.isWord) {
              return <span key={tIdx}>{token.text}</span>;
            }

            const isTagEnabled = enabledTags[token.pos];
            const shouldColor = isSentenceHighlighted && isTagEnabled;
            const style = POS_STYLES[token.pos] || POS_STYLES.other;

            // Kiểm tra xem token này có thuộc cụm từ nào không
            const phrase = tokenMap?.get(tIdx);
            const isPhraseHovered = phrase && hoveredPhraseId === phrase.id;

            let tokenClass = "text-inherit";
            if (shouldColor) {
              if (highlightMode === "underline") {
                tokenClass = "border-b-2 font-medium";
              } else {
                tokenClass = style.twTextClass;
              }
            }

            // Hiệu ứng gom sáng liên kết khi hover vào bất kỳ từ nào trong cụm
            const phraseHighlightClass = isPhraseHovered
              ? "bg-[#dbeafe] text-[#0369a1] font-bold rounded-xs ring-1 ring-[#38bdf8]"
              : "";

            return (
              <span
                key={tIdx}
                onMouseEnter={(e) =>
                  handleWordMouseEnter(e, token.cleanText, token.text, token.pos, phrase)
                }
                onMouseLeave={handleWordMouseLeave}
                style={
                  shouldColor && highlightMode === "underline" && !isPhraseHovered
                    ? { borderBottomColor: style.textColor }
                    : undefined
                }
                className={`inline-block rounded-xs px-0.5 transition-all duration-100 cursor-help ${tokenClass} ${phraseHighlightClass} hover:bg-[#fff9d2] hover:text-black`}
              >
                {token.text}
              </span>
            );
          })}
        </span>
      );
    });
  }
}
