"use client";

import React, { useState, useEffect } from "react";
import { Volume2, Plus, Check, Loader2 } from "lucide-react";
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
    if (data.contextMeaning && data.ipa) {
      return {
        phonetic: data.ipa,
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
    if (data.contextMeaning && data.ipa) return false;
    if (cached) return false;
    return true;
  });
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (data.contextMeaning && data.ipa) return;
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
  }, [data.cleanWord, data.contextMeaning, data.ipa]);

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
  const top = data.rect.bottom + 8;
  const left = Math.max(16, Math.min(window.innerWidth - 320, data.rect.left - 40));

  return (
    <div
      style={{ top: `${top}px`, left: `${left}px` }}
      className="fixed z-40 w-72 rounded-xl border-2 border-b-4 border-[#e5e5e5] bg-white p-3.5 shadow-xl animate-in fade-in zoom-in-95 duration-150"
      onMouseEnter={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-extrabold text-eel-dark-blue">{data.cleanWord}</span>
            <button
              onClick={playAudio}
              className="rounded-md p-1 text-ash hover:bg-[#e5f6fd] hover:text-[#1cb0f6] transition-colors"
              title="Phát âm"
            >
              <Volume2 className="size-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {details?.phonetic && (
              <span className="font-mono text-xs text-ash">{details.phonetic}</span>
            )}
            <span className={`rounded px-1.5 py-0.2 text-[10px] font-bold border ${posDef.bgBadge}`}>
              {posDef.labelVi}
            </span>
          </div>
        </div>

        {onSaveToDeck && (
          <button
            onClick={handleSave}
            disabled={isSaving || isSaved}
            className={`flex items-center gap-1 rounded-lg border-2 px-2.5 py-1 text-xs font-black transition-all ${
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
                <Plus className="size-3.5" /> Lưu từ
              </>
            )}
          </button>
        )}
      </div>

      <div className="mt-2.5 border-t border-[#f0f0f0] pt-2 text-xs">
        {loading ? (
          <div className="flex items-center gap-1.5 py-2 text-ash">
            <Loader2 className="size-3.5 animate-spin" />
            <span>Đang tra cứu từ điển...</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {details?.translationVi && (
              <div className="font-bold text-eel-dark-blue">
                🇻🇳 <span className="text-[#042c60]">{details.translationVi}</span>
              </div>
            )}
            {details?.definition && (
              <p className="text-charcoal leading-relaxed line-clamp-2">
                📖 {details.definition}
              </p>
            )}
            {details?.synonyms && details.synonyms.length > 0 && (
              <div className="text-[11px] text-ash pt-0.5">
                <span className="font-bold">Đồng nghĩa: </span>
                <span>{details.synonyms.join(", ")}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function WordPopover({ data, onSaveToDeck }: WordPopoverProps) {
  if (!data) return null;
  return <WordPopoverContent key={data.cleanWord} data={data} onSaveToDeck={onSaveToDeck} />;
}
