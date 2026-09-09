"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  Check,
  Sparkles,
  Underline,
  EyeOff,
  Quote,
  Filter,
  Minus,
  Plus,
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

type HighlightMode = "focus" | "underline" | "none";
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

const ALL_POS_TAGS: POSTag[] = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "pronoun",
  "preposition",
  "conjunction",
  "determiner",
  "other",
];

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

  // State menu dropdown bộ lọc từ loại
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // State menu popover tùy chỉnh font & size (Aa)
  const [isTypographyOpen, setIsTypographyOpen] = useState(false);
  const typographyRef = useRef<HTMLDivElement>(null);

  // Tùy chỉnh công thái học hiển thị (Typography)
  const [fontSize, setFontSize] = useState<FontSize>("base");
  const [fontFamily, setFontFamily] = useState<FontFamily>("sans");

  // Cụm từ đang được hover để gom sáng toàn bộ các từ trong cụm
  const [hoveredPhraseId, setHoveredPhraseId] = useState<string | null>(null);

  // State cho hover Popover
  const [popoverData, setPopoverData] = useState<WordPopoverData | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Đếm số lượng tag đang kích hoạt
  const activeFilterCount = useMemo(() => {
    return Object.values(enabledTags).filter(Boolean).length;
  }, [enabledTags]);

  // Đóng dropdown khi click ra ngoài hoặc bấm Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const node = event.target as Node;
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(node)
      ) {
        setIsFilterOpen(false);
      }
      if (
        typographyRef.current &&
        !typographyRef.current.contains(node)
      ) {
        setIsTypographyOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFilterOpen(false);
        setIsTypographyOpen(false);
      }
    };

    if (isFilterOpen || isTypographyOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFilterOpen, isTypographyOpen]);

  // Điều hướng câu bằng phím tắt (ArrowUp/ArrowDown hoặc J/K)
  useEffect(() => {
    const handleNavigationKeyDown = (e: KeyboardEvent) => {
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

      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      const isDown = e.key === "ArrowDown" || e.key === "j" || e.key === "J";
      const isUp = e.key === "ArrowUp" || e.key === "k" || e.key === "K";

      if (!isDown && !isUp) return;

      const allSentences = paragraphs.flatMap((p) => p.sentences);
      if (allSentences.length === 0) return;

      e.preventDefault();

      const currentIndex = allSentences.findIndex((s) => s.id === activeSentenceId);

      let nextSentence: SentenceItem | undefined;
      if (isDown) {
        if (currentIndex === -1 || currentIndex >= allSentences.length - 1) {
          nextSentence = allSentences[0];
        } else {
          nextSentence = allSentences[currentIndex + 1];
        }
      } else if (isUp) {
        if (currentIndex <= 0) {
          nextSentence = allSentences[allSentences.length - 1];
        } else {
          nextSentence = allSentences[currentIndex - 1];
        }
      }

      if (nextSentence) {
        onSelectSentence(nextSentence);
        const el = document.getElementById(`sentence-${nextSentence.id}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    };

    window.addEventListener("keydown", handleNavigationKeyDown);
    return () => window.removeEventListener("keydown", handleNavigationKeyDown);
  }, [paragraphs, activeSentenceId, onSelectSentence]);

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

  const setAllTags = (value: boolean) => {
    const next: Record<POSTag, boolean> = {
      noun: value,
      verb: value,
      adjective: value,
      adverb: value,
      pronoun: value,
      preposition: value,
      conjunction: value,
      determiner: value,
      other: value,
    };
    setEnabledTags(next);
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
    }, 250);
  };

  const handlePopoverMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  };

  const handlePopoverMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredPhraseId(null);
      setPopoverData(null);
    }, 200);
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
    <div className="relative flex h-full flex-col rounded-2xl border-2 border-b-4 border-[#e5e5e5] bg-white shadow-xs overflow-hidden">
      {/* Floating Micro-Pill: Nổi ở góc trên bên phải, chiếm đúng 0px chiều cao trong luồng văn bản */}
      <div className="absolute top-2.5 right-3.5 z-20 flex items-center gap-1 rounded-xl border border-[#e5e5e5] bg-white/95 p-0.5 shadow-sm backdrop-blur-xs">
        {/* Segmented control icon gọn gàng (✦ | U | ✕) */}
        <div className="inline-flex items-center rounded-lg bg-[#f5f5f5] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setHighlightMode("focus")}
            className={`flex size-6 items-center justify-center rounded-md transition-all cursor-pointer ${
              highlightMode === "focus"
                ? "bg-[#e5f6fd] text-[#1cb0f6] shadow-2xs font-black"
                : "text-ash hover:text-charcoal"
            }`}
            title="Chỉ làm nổi bật câu đang chọn (Focus)"
          >
            <Sparkles className="size-3" />
          </button>

          <button
            type="button"
            onClick={() => setHighlightMode("underline")}
            className={`flex size-6 items-center justify-center rounded-md transition-all cursor-pointer ${
              highlightMode === "underline"
                ? "bg-[#f3e8ff] text-[#9333ea] shadow-2xs font-black"
                : "text-ash hover:text-charcoal"
            }`}
            title="Gạch chân màu theo từ loại"
          >
            <Underline className="size-3" />
          </button>

          <button
            type="button"
            onClick={() => setHighlightMode("none")}
            className={`flex size-6 items-center justify-center rounded-md transition-all cursor-pointer ${
              highlightMode === "none"
                ? "bg-gray-200 text-charcoal shadow-2xs font-black"
                : "text-ash hover:text-charcoal"
            }`}
            title="Tắt toàn bộ màu từ loại"
          >
            <EyeOff className="size-3" />
          </button>
        </div>

        {/* Menu Popover/Dropdown: Bộ lọc từ loại (Filter) */}
        {highlightMode !== "none" && (
          <div className="relative" ref={filterDropdownRef}>
            <button
              type="button"
              onClick={() => setIsFilterOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1 rounded-md border h-6 px-1.5 text-[11px] font-bold transition-all cursor-pointer ${
                isFilterOpen || activeFilterCount > 0
                  ? "border-[#bfe9fd] bg-[#f0f9ff] text-[#0284c7]"
                  : "border-[#e5e5e5] bg-[#fafafa] text-ash hover:text-charcoal"
              }`}
              title={`Bộ lọc từ loại (${activeFilterCount}/${ALL_POS_TAGS.length})`}
            >
              <Filter className="size-3 text-[#1cb0f6]" />
              <span className="text-[10px] font-black text-[#0369a1]">
                {activeFilterCount}
              </span>
            </button>

            {/* Dropdown Popover Content */}
            {isFilterOpen && (
              <div className="absolute right-0 top-full z-40 mt-1.5 w-60 rounded-xl border-2 border-[#e5e5e5] bg-white p-2.5 shadow-lg animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-2 mb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-eel-dark-blue">
                    Bộ lọc từ loại ({activeFilterCount}/{ALL_POS_TAGS.length})
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAllTags(true)}
                      className="text-[10px] font-bold text-[#1cb0f6] hover:underline"
                    >
                      Bật hết
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => setAllTags(false)}
                      className="text-[10px] font-bold text-ash hover:underline"
                    >
                      Tắt hết
                    </button>
                  </div>
                </div>

                <div className="space-y-1 max-h-64 overflow-y-auto pr-0.5">
                  {ALL_POS_TAGS.map((tag) => {
                    const isEnabled = enabledTags[tag];
                    const def = POS_STYLES[tag];

                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-bold transition-colors ${
                          isEnabled
                            ? "bg-[#f8fafc] text-charcoal hover:bg-[#f1f5f9]"
                            : "text-ash hover:bg-gray-50 opacity-60"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: def.textColor }}
                          />
                          <span>{def.labelVi}</span>
                          <span className="text-[10px] font-normal text-ash">
                            ({def.label})
                          </span>
                        </div>

                        <div
                          className={`flex size-4 items-center justify-center rounded border transition-colors ${
                            isEnabled
                              ? "border-[#1cb0f6] bg-[#1cb0f6] text-white"
                              : "border-[#d4d4d4] bg-white"
                          }`}
                        >
                          {isEnabled && <Check className="size-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="h-3.5 w-px bg-[#e5e5e5] mx-0.5" />

        {/* Nút tùy chỉnh hiển thị Aa (Font & Cỡ chữ) dạng Popover chuẩn E-Reader */}
        <div className="relative" ref={typographyRef}>
          <button
            type="button"
            onClick={() => setIsTypographyOpen((prev) => !prev)}
            className={`inline-flex items-center gap-0.5 rounded-md border h-6 px-1.5 text-xs font-bold transition-all cursor-pointer ${
              isTypographyOpen
                ? "border-[#bfe9fd] bg-[#f0f9ff] text-[#0284c7]"
                : "border-[#e5e5e5] bg-[#fafafa] text-charcoal hover:bg-white hover:border-[#1cb0f6]"
            }`}
            title="Tùy chỉnh cỡ chữ & phông chữ (Aa)"
          >
            <span className="font-serif text-xs font-black leading-none">A</span>
            <span className="text-[10px] font-bold text-ash leading-none">a</span>
          </button>

          {/* Popover tùy chỉnh Font & Cỡ chữ */}
          {isTypographyOpen && (
            <div className="absolute right-0 top-full z-40 mt-1.5 w-56 rounded-xl border-2 border-[#e5e5e5] bg-white p-3 shadow-xl animate-in fade-in zoom-in-95 duration-100 space-y-3">
              {/* Phông chữ: Sans vs Serif */}
              <div>
                <span className="text-[10.5px] font-black uppercase tracking-wider text-ash block mb-1.5">
                  Phông chữ
                </span>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-0.5 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setFontFamily("sans")}
                    className={`rounded-md py-1 text-center transition-all cursor-pointer ${
                      fontFamily === "sans"
                        ? "bg-white text-eel-dark-blue shadow-2xs font-black"
                        : "text-ash hover:text-charcoal"
                    }`}
                  >
                    Sans
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontFamily("serif")}
                    className={`rounded-md py-1 font-serif text-center transition-all cursor-pointer ${
                      fontFamily === "serif"
                        ? "bg-white text-eel-dark-blue shadow-2xs font-black"
                        : "text-ash hover:text-charcoal"
                    }`}
                  >
                    Serif
                  </button>
                </div>
              </div>

              {/* Cỡ chữ: A- | Cỡ | A+ */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10.5px] font-black uppercase tracking-wider text-ash">
                    Cỡ chữ
                  </span>
                  <span className="font-mono text-[11px] font-bold text-charcoal">
                    {fontSize === "sm"
                      ? "14px"
                      : fontSize === "base"
                      ? "16px"
                      : fontSize === "lg"
                      ? "18px"
                      : "20px"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-1">
                  <button
                    type="button"
                    onClick={decreaseFontSize}
                    disabled={fontSize === "sm"}
                    className="flex size-7 items-center justify-center rounded-md bg-white border border-[#e5e5e5] text-charcoal hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white transition-colors cursor-pointer disabled:cursor-not-allowed shadow-2xs"
                    title="Giảm cỡ chữ (A-)"
                  >
                    <Minus className="size-3.5" />
                  </button>

                  <span className="text-xs font-extrabold text-eel-dark-blue uppercase">
                    {fontSize}
                  </span>

                  <button
                    type="button"
                    onClick={increaseFontSize}
                    disabled={fontSize === "xl"}
                    className="flex size-7 items-center justify-center rounded-md bg-white border border-[#e5e5e5] text-charcoal hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white transition-colors cursor-pointer disabled:cursor-not-allowed shadow-2xs"
                    title="Tăng cỡ chữ (A+)"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Vùng đọc nội dung cuộn (Document Flow Area) */}
      <div
        onMouseUp={handleMouseUp}
        className={`flex-1 overflow-y-auto p-5 md:p-7 space-y-5 select-text ${
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
          if (block.type === "heading") {
            const HeadingTag =
              block.headingLevel === 1 ? "h2" : block.headingLevel === 2 ? "h3" : "h4";
            const headingClasses =
              block.headingLevel === 1
                ? "text-2xl font-black text-eel-dark-blue border-b-2 border-[#eeeeee] pb-2 mt-5 mb-2.5 tracking-tight"
                : block.headingLevel === 2
                ? "text-xl font-extrabold text-eel-dark-blue mt-4 mb-2"
                : "text-lg font-bold text-eel-dark-blue mt-3.5 mb-1.5";

            return (
              <HeadingTag key={block.id} className={headingClasses}>
                {block.sentences.map((sent) => (
                  <span
                    key={sent.id}
                    id={`sentence-${sent.id}`}
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
                className="border-l-4 border-[#58cc02] bg-[#f9fdf5] pl-4 py-2.5 my-2.5 italic rounded-r-xl"
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
        onMouseEnter={handlePopoverMouseEnter}
        onMouseLeave={handlePopoverMouseLeave}
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
        highlightMode === "underline" ||
        (highlightMode === "focus" && isActive);

      return (
        <span
          key={sentence.id}
          id={`sentence-${sentence.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelectSentence(sentence);
          }}
          className={`inline rounded-lg px-1.5 py-0.5 cursor-pointer transition-all duration-150 ${
            isActive
              ? "bg-[#e5f6fd] outline outline-2 outline-[#1cb0f6] text-black font-semibold shadow-2xs"
              : "hover:bg-[#f2f9ff] hover:outline hover:outline-1 hover:outline-[#bfe9fd]"
          }`}
          title="Click để phân tích câu này (hoặc bấm ↑/↓, J/K)"
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
