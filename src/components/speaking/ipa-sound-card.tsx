"use client";

import { Volume2 } from "lucide-react";
import type { IpaSound } from "@/lib/ipa/types";
import { cn } from "@/lib/utils";

interface IpaSoundCardProps {
  sound: IpaSound;
  isSelected: boolean;
  onSelect: (sound: IpaSound) => void;
  onPlayAudio: (sound: IpaSound, e: React.MouseEvent) => void;
  cardRef?: (el: HTMLButtonElement | null) => void;
}

export function IpaSoundCard({
  sound,
  isSelected,
  onSelect,
  onPlayAudio,
  cardRef,
}: IpaSoundCardProps) {
  return (
    <button
      ref={cardRef}
      type="button"
      onClick={() => onSelect(sound)}
      className={cn(
        "group relative flex w-full items-center justify-between rounded-xl border-2 p-3.5 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lingot-lime/40 active:translate-y-0.5",
        isSelected
          ? "border-[#438f0e] bg-[#f7fff1] shadow-sm"
          : "border-[#e5e5e5] bg-white hover:border-[#d0d0d0] hover:bg-[#fafafa]",
      )}
    >
      <div className="flex items-center gap-3.5">
        <div
          className={cn(
            "grid size-12 place-items-center rounded-lg font-display text-xl font-black transition-colors",
            isSelected
              ? "bg-[#438f0e] text-white"
              : "bg-[#f4f4f4] text-eel-dark-blue group-hover:bg-[#eaeaea]",
          )}
        >
          {sound.symbol}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-charcoal">{sound.name}</h3>
            <span className="text-xs font-bold text-ash">({sound.vietnameseName})</span>
          </div>
          <p className="text-xs font-extrabold text-ash">
            Ví dụ:{" "}
            <span className="text-eel-dark-blue">
              {sound.examples[0]?.word} ({sound.examples[0]?.ipa})
            </span>
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => onPlayAudio(sound, e)}
        title="Nghe phát âm"
        className={cn(
          "grid size-9 place-items-center rounded-lg border-2 transition-colors",
          isSelected
            ? "border-eel-light bg-white text-[#438f0e] hover:bg-[#f0f9eb]"
            : "border-[#e5e5e5] bg-[#f9f9f9] text-ash hover:border-[#ccc] hover:text-charcoal",
        )}
      >
        <Volume2 className="size-4" />
      </button>
    </button>
  );
}
