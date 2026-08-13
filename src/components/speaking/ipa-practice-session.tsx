"use client";

import { useRef, useState } from "react";
import { Volume2, VolumeX, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IPA_SOUNDS, getIpaSoundsByCategory } from "@/lib/ipa/ipa-data";
import type { IpaCategory, IpaSound } from "@/lib/ipa/types";
import { speakIpaSound } from "@/lib/speech";
import { IpaSoundCard } from "./ipa-sound-card";
import { IpaSoundDetail } from "./ipa-sound-detail";

export function IpaPracticeSession() {
  const [selectedSound, setSelectedSound] = useState<IpaSound>(IPA_SOUNDS[0]);
  const [activeCategory, setActiveCategory] = useState<IpaCategory | "all">("all");
  const [autoPlay, setAutoPlay] = useState<boolean>(true);

  // Map lưu ref của từng card để thực hiện scrollIntoView
  const cardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const handleSelectSound = (sound: IpaSound) => {
    setSelectedSound(sound);

    // Tự động cuộn card được chọn vào vị trí giữa danh sách
    const cardEl = cardRefs.current.get(sound.id);
    if (cardEl) {
      cardEl.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }

    // Tự động phát âm IPA khi chuyển card nếu bật autoPlay
    if (autoPlay) {
      speakIpaSound(sound.id, sound.symbol, sound.audioUrl);
    }
  };

  const handlePlayAudio = (sound: IpaSound, e: React.MouseEvent) => {
    e.stopPropagation();
    speakIpaSound(sound.id, sound.symbol, sound.audioUrl);
  };

  const filteredSounds =
    activeCategory === "all"
      ? IPA_SOUNDS
      : getIpaSoundsByCategory(activeCategory);

  return (
    <div className="flex flex-col gap-6">
      {/* FILTER BAR & TOGGLE AUTOPLAY */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-[#e5e5e5] bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={activeCategory === "all" ? "default" : "outline"}
            onClick={() => setActiveCategory("all")}
          >
            Tất cả (44 âm)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeCategory === "monophthong" ? "default" : "outline"}
            onClick={() => setActiveCategory("monophthong")}
          >
            Nguyên âm đơn (12)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeCategory === "diphthong" ? "default" : "outline"}
            onClick={() => setActiveCategory("diphthong")}
          >
            Nguyên âm đôi (8)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeCategory === "consonant" ? "default" : "outline"}
            onClick={() => setActiveCategory("consonant")}
          >
            Phụ âm (24)
          </Button>
        </div>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setAutoPlay(!autoPlay)}
          className="gap-2 text-xs font-bold text-ash hover:text-charcoal"
        >
          {autoPlay ? (
            <>
              <Volume2 className="size-4 text-[#438f0e]" /> Tự động phát âm (Bật)
            </>
          ) : (
            <>
              <VolumeX className="size-4 text-ash" /> Tự động phát âm (Tắt)
            </>
          )}
        </Button>
      </div>

      {/* TWO-COLUMN LAYOUT */}
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* LEFT COLUMN: SCROLLABLE LIST OF CARDS */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-extrabold text-eel-dark-blue flex items-center gap-1.5">
              <Sparkles className="size-4 text-[#438f0e]" /> Danh sách âm ({filteredSounds.length})
            </h2>
            <span className="text-xs font-bold text-ash">Click để chọn & tự động cuộn</span>
          </div>

          <div className="max-h-[calc(100vh-220px)] space-y-2.5 overflow-y-auto pr-1">
            {filteredSounds.map((sound) => (
              <IpaSoundCard
                key={sound.id}
                sound={sound}
                isSelected={selectedSound.id === sound.id}
                onSelect={handleSelectSound}
                onPlayAudio={handlePlayAudio}
                cardRef={(el) => cardRefs.current.set(sound.id, el)}
              />
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: DETAILED INFO PANEL */}
        <div>
          {selectedSound ? (
            <IpaSoundDetail sound={selectedSound} />
          ) : (
            <div className="grid h-64 place-items-center rounded-2xl border-2 border-dashed border-[#e5e5e5] bg-white p-6 text-center text-sm font-bold text-ash">
              Chọn một âm bất kỳ từ cột bên trái để xem thông tin chi tiết.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
