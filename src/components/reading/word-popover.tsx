"use client";

import React, { useState, useEffect } from "react";
import { Volume2, Plus, Check, Loader2, Link2 } from "lucide-react";
import { POS_STYLES } from "@/lib/reading/pos-tagger";
import {
  getCachedWord,
  fetchWordDetails,
  type DictResult,
} from "@/lib/reading/dictionary-cache";
import type { POSTag } from "@/types/reading";

export interface WordPopoverData {
  word: string;
  cleanWord: string;
  pos: POSTag;
  rect: DOMRect;
  contextMeaning?: string;
  ipa?: string;
  isPhrase?: boolean;
  phraseType?: "collocation" | "phrasal_verb" | "idiom" | "selection";
  subWords?: Array<{
    word: string;
    cleanWord: string;
    pos: POSTag;
  }>;
}

interface WordPopoverProps {
  data: WordPopoverData | null;
  onClose?: () => void;
  onSaveToDeck?: (word: string, translation: string, phonetic: string) => Promise<void>;
}

function WordPopoverContent({
  data,
  onSaveToDeck,
}: {
  data: WordPopoverData;
  onSaveToDeck?: (word: string, translation: string, phonetic: string) => Promise<void>;
}) {
  const cached = getCachedWord(data.cleanWord);

  const [details, setDetails] = useState<DictResult | null>(() => {
    if (data.contextMeaning) {
      return {
        phonetic: data.ipa || "",
        translationVi: data.contextMeaning,
      };
    }
    if (cached) {
      return {
        ...cached,
        translationVi: data.contextMeaning || cached.translationVi,
      };
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (data.contextMeaning && (data.ipa || data.isPhrase)) return false;
    if (cached && (cached.translationVi || cached.definition)) return false;
    return true;
  });

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (data.contextMeaning && (data.ipa || data.isPhrase)) return;
    if (getCachedWord(data.cleanWord)) return;

    let active = true;
    fetchWordDetails(data.cleanWord, data.contextMeaning, data.ipa)
      .then((res) => {
        if (active) {
          setDetails(res);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [data.cleanWord, data.contextMeaning, data.ipa, data.isPhrase]);

  const playAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(data.cleanWord);
      utter.lang = "en-US";
      utter.rate = 0.9;
      window.speechSynthesis.speak(utter);
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSaveToDeck || isSaving || isSaved) return;

    setIsSaving(true);
    try {
      const translation = details?.translationVi || details?.definition || data.cleanWord;
      const phonetic = details?.phonetic || data.ipa || "";
      await onSaveToDeck(data.cleanWord, translation, phonetic);
      setIsSaved(true);
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  };

  const posDef = POS_STYLES[data.pos] || POS_STYLES.other;
  const top =
    typeof window !== "undefined" && data.rect.bottom + 260 > window.innerHeight
      ? Math.max(16, data.rect.top - 260)
      : data.rect.bottom + 8;
  const left =
    typeof window !== "undefined"
      ? Math.max(16, Math.min(window.innerWidth - 340, data.rect.left - 40))
      : data.rect.left;

  const phraseBadgeText =
    data.phraseType === "phrasal_verb"
      ? "Cụm động từ"
      : data.phraseType === "idiom"
      ? "Thành ngữ"
      : data.phraseType === "selection"
      ? "Đoạn đã chọn"
      : "Cụm từ liên kết";

  return (
    <div
      style={{ top: `${top}px`, left: `${left}px` }}
      className="fixed z-40 w-80 rounded-2xl border-2 border-b-4 border-[#e5e5e5] bg-white p-4 shadow-xl animate-in fade-in zoom-in-95 duration-150"
      onMouseEnter={(e) => e.stopPropagation()}
    >
      {/* Header Bar */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {data.isPhrase && <Link2 className="size-4 text-[#1cb0f6] shrink-0" />}
            <span className="text-base font-extrabold text-eel-dark-blue truncate">
              {data.cleanWord}
            </span>
            <button
              onClick={playAudio}
              className="rounded-md p-1 text-ash hover:bg-[#e5f6fd] hover:text-[#1cb0f6] transition-colors"
              title="Phát âm"
            >
              <Volume2 className="size-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {data.isPhrase ? (
              <span className="rounded-md bg-[#e5f6fd] border border-[#bfe9fd] px-1.5 py-0.5 text-[10px] font-black text-[#087db4]">
                {phraseBadgeText}
              </span>
            ) : (
              <>
                {details?.phonetic && (
                  <span className="font-mono text-xs text-ash">{details.phonetic}</span>
                )}
                <span className={`rounded px-1.5 py-0.2 text-[10px] font-bold border ${posDef.bgBadge}`}>
                  {posDef.labelVi}
                </span>
              </>
            )}
          </div>
        </div>

        {onSaveToDeck && (
          <button
            onClick={handleSave}
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
                <Plus className="size-3.5" /> {data.isPhrase ? "Lưu cụm" : "Lưu từ"}
              </>
            )}
          </button>
        )}
      </div>

      {/* Chi tiết nghĩa & từ thành phần */}
      <div className="mt-3 border-t border-[#f0f0f0] pt-2.5 text-xs space-y-2">
        {loading ? (
          <div className="flex items-center gap-1.5 py-2 text-ash">
            <Loader2 className="size-3.5 animate-spin" />
            <span>Đang tra cứu từ điển...</span>
          </div>
        ) : (
          <>
            {details?.translationVi && (
              <div className="rounded-lg bg-[#f7fff1] border border-[#d7ffb8] p-2 text-xs font-bold text-eel-dark-blue">
                <span className="text-[#438f0e] block text-[10px] font-black mb-0.5">
                  🇻🇳 NGHĨA NGỮ CẢNH:
                </span>
                <span className="text-sm font-black text-eel-dark-blue">
                  {details.translationVi}
                </span>
              </div>
            )}

            {details?.definition && (
              <p className="text-charcoal leading-relaxed line-clamp-2 text-[11.5px]">
                📖 {details.definition}
              </p>
            )}

            {/* Nếu là cụm từ: hiển thị các từ con thành phần */}
            {data.isPhrase && data.subWords && data.subWords.length > 0 && (
              <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-2">
                <span className="text-[10px] font-bold text-ash block mb-1">
                  Từ thành phần trong cụm:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {data.subWords.map((sw, idx) => {
                    const sDef = POS_STYLES[sw.pos] || POS_STYLES.other;
                    return (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded bg-white border border-[#e5e5e5] px-1.5 py-0.5 text-[11px]"
                      >
                        <span className="font-semibold text-charcoal">{sw.cleanWord}</span>
                        <span className={`text-[9px] font-bold ${sDef.twTextClass}`}>
                          ({sDef.labelVi})
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {details?.synonyms && details.synonyms.length > 0 && (
              <div className="text-[11px] text-ash pt-0.5">
                <span className="font-bold">Đồng nghĩa: </span>
                <span>{details.synonyms.join(", ")}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function WordPopover({ data, onSaveToDeck }: WordPopoverProps) {
  if (!data) return null;
  return <WordPopoverContent key={data.cleanWord} data={data} onSaveToDeck={onSaveToDeck} />;
}
