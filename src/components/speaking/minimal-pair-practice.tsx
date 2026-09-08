"use client";

import { useState } from "react";
import { Volume2, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MinimalPair } from "@/lib/ipa/types";
import { speakEnglish } from "@/lib/speech";

interface MinimalPairPracticeProps {
  minimalPairs: MinimalPair[];
  soundSymbol: string;
}

export function MinimalPairPractice({
  minimalPairs,
  soundSymbol,
}: MinimalPairPracticeProps) {
  if (!minimalPairs || minimalPairs.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-[#e5e5e5] p-6 text-center text-sm font-bold text-ash">
        Không có cặp âm dễ nhầm lẫn đặc trưng nào cho âm {soundSymbol}.
      </div>
    );
  }

  const playWord = (word: string) => {
    speakEnglish(word, "normal");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h4 className="font-extrabold text-eel-dark-blue flex items-center gap-2">
          <ArrowRightLeft className="size-4 text-[#438f0e]" /> Cặp âm dễ nhầm lẫn (Minimal Pairs)
        </h4>
        <span className="text-xs font-bold text-ash">
          So sánh sự khác biệt khi phát âm
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {minimalPairs.map((pair, idx) => (
          <div
            key={idx}
            className="flex flex-col gap-3 rounded-xl border-2 border-b-4 border-[#e5e5e5] border-b-[#dedede] bg-white p-4"
          >
            <div className="grid grid-cols-2 gap-3 divide-x-2 divide-[#f0f0f0]">
              {/* Target Word */}
              <div className="flex flex-col items-center text-center pr-2">
                <span className="text-[10px] font-extrabold uppercase text-[#438f0e] bg-[#f7fff1] px-2 py-0.5 rounded border border-eel-light mb-1">
                  Âm chuẩn {soundSymbol}
                </span>
                <span className="font-display text-lg font-black text-eel-dark-blue">
                  {pair.targetWord.word}
                </span>
                <span className="text-xs font-bold text-ash">{pair.targetWord.ipa}</span>
                <span className="text-xs font-bold text-charcoal mt-1">
                  &quot;{pair.targetWord.translation}&quot;
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => playWord(pair.targetWord.word)}
                  className="mt-2 h-8 w-full gap-1.5 text-xs font-bold"
                >
                  <Volume2 className="size-3.5" /> Nghe
                </Button>
              </div>

              {/* Confused Word */}
              <div className="flex flex-col items-center text-center pl-3">
                <span className="text-[10px] font-extrabold uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 mb-1">
                  Dễ nhầm với {pair.confusedSoundSymbol}
                </span>
                <span className="font-display text-lg font-black text-charcoal">
                  {pair.confusedWord.word}
                </span>
                <span className="text-xs font-bold text-ash">{pair.confusedWord.ipa}</span>
                <span className="text-xs font-bold text-charcoal mt-1">
                  &quot;{pair.confusedWord.translation}&quot;
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => playWord(pair.confusedWord.word)}
                  className="mt-2 h-8 w-full gap-1.5 text-xs font-bold"
                >
                  <Volume2 className="size-3.5" /> Nghe
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
