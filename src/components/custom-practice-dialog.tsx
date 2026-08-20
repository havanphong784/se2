"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Brain,
  Check,
  HelpCircle,
  Info,
  Keyboard,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VocabularyDeck, VocabularyWord } from "@/lib/demo-data";
import type { StudyPhase } from "@/lib/study";
import { cn } from "@/lib/utils";

type CustomPracticeDialogProps = {
  deck?: VocabularyDeck;
  practiceWords: VocabularyWord[];
};

export function CustomPracticeDialog({
  deck,
  practiceWords,
}: CustomPracticeDialogProps) {
  const [open, setOpen] = useState(false);
  const totalWords = practiceWords.length;
  const scopeLabel = deck ? deck.title : "Tất cả bộ từ vựng";

  const countOptions = [5, 10, 15, 20].filter((c) => c < totalWords);
  const [selectedCount, setSelectedCount] = useState<number | "all">(
    countOptions[0] ?? "all",
  );
  const [selectedPhase, setSelectedPhase] = useState<StudyPhase>("flashcard");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [open]);

  if (totalWords === 0) {
    return (
      <Button
        variant="secondary"
        size="lg"
        disabled
        className="w-full opacity-60 md:w-auto"
      >
        <RotateCcw className="size-5" /> {deck ? "Ôn từ đã học (0)" : "Ôn từ mới học (0)"}
      </Button>
    );
  }

  const phaseOptions: Array<{
    id: StudyPhase;
    title: string;
    description: string;
    icon: typeof Brain;
  }> = [
    {
      id: "flashcard",
      title: "Flashcard",
      description: "Xem lại thẻ từ vựng & phát âm",
      icon: Sparkles,
    },
    {
      id: "multiple_choice",
      title: "Trắc nghiệm",
      description: "Chọn nghĩa đúng từ 4 lựa chọn",
      icon: HelpCircle,
    },
    {
      id: "typing",
      title: "Nhập từ",
      description: "Gõ từ tiếng Anh chuẩn xác",
      icon: Keyboard,
    },
  ];

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={() => setOpen(true)}
        className="w-full border-macaw-blue text-[#087db4] hover:bg-[#f5fbff] md:w-auto"
      >
        <RotateCcw className="size-5" /> {deck ? "Ôn từ đã học" : "Ôn từ mới học hôm nay"} ({totalWords})
      </Button>

      {open && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="custom-practice-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border-2 border-b-4 border-eel-light bg-white p-6 md:p-8">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 grid size-9 place-items-center rounded-xl text-ash hover:bg-[#f0f0f0]"
              aria-label="Đóng hộp thoại"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-xl bg-[#f0f7ff] text-macaw-blue">
                <RotateCcw className="size-6" />
              </span>
              <div>
                <Badge variant="blue" className="mb-1">
                  Tự chọn • Không tính điểm
                </Badge>
                <h2 id="custom-practice-title" className="font-display text-2xl font-extrabold text-eel-dark-blue">
                  {deck ? "Ôn tập từ đã học trong gói" : "Ôn lại từ mới học hôm nay"}
                </h2>
              </div>
            </div>

            <p className="mt-3 text-sm font-bold text-ash">
              {deck ? (
                <>Bộ từ: <strong className="text-charcoal">{scopeLabel}</strong> • Có {totalWords} từ đã học.</>
              ) : (
                <>Phạm vi: <strong className="text-charcoal">{scopeLabel}</strong> • Có {totalWords} từ vừa học hôm nay.</>
              )}
            </p>

            <div className="mt-6 space-y-5">
              {/* Option 1: Word Count */}
              <div>
                <label className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-ash">
                  1. Số lượng từ ôn tập
                </label>
                <div className="grid grid-cols-4 gap-2" role="group" aria-label="Chọn số lượng từ ôn tập">
                  {countOptions.map((count) => (
                    <button
                      key={count}
                      type="button"
                      aria-pressed={selectedCount === count}
                      onClick={() => setSelectedCount(count)}
                      className={cn(
                        "flex min-h-12 flex-col items-center justify-center rounded-xl border-2 border-b-4 font-extrabold transition",
                        selectedCount === count
                          ? "border-macaw-blue bg-[#f0f7ff] text-macaw-blue"
                          : "border-[#dedede] bg-white text-ash hover:border-macaw-blue",
                      )}
                    >
                      {count} từ
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-pressed={selectedCount === "all"}
                    onClick={() => setSelectedCount("all")}
                    className={cn(
                      "flex min-h-12 flex-col items-center justify-center rounded-xl border-2 border-b-4 font-extrabold transition",
                      selectedCount === "all"
                        ? "border-macaw-blue bg-[#f0f7ff] text-macaw-blue"
                        : "border-[#dedede] bg-white text-ash hover:border-macaw-blue",
                    )}
                  >
                    Tất cả ({totalWords})
                  </button>
                </div>
              </div>

              {/* Option 2: Practice Type */}
              <div>
                <label className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-ash">
                  2. Chọn kiểu ôn tập (1 trong 3 kiểu)
                </label>
                <div className="grid gap-2.5" role="group" aria-label="Chọn kiểu ôn tập">
                  {phaseOptions.map((opt) => {
                    const Icon = opt.icon;
                    const selected = selectedPhase === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSelectedPhase(opt.id)}
                        className={cn(
                          "flex items-center gap-3.5 rounded-xl border-2 border-b-4 p-3.5 text-left transition",
                          selected
                            ? "border-ecto-green bg-[#f7fff1] text-eel-dark-blue"
                            : "border-[#dedede] bg-white text-charcoal hover:border-macaw-blue",
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-10 shrink-0 place-items-center rounded-lg border-2",
                            selected
                              ? "border-ecto-green bg-ecto-green text-white"
                              : "border-[#dedede] bg-[#f8f8f8] text-ash",
                          )}
                        >
                          <Icon className="size-5" />
                        </span>
                        <div className="flex-1">
                          <p className="text-base font-extrabold leading-snug">
                            {opt.title}
                          </p>
                          <p className="text-xs font-bold text-ash">
                            {opt.description}
                          </p>
                        </div>
                        {selected && (
                          <Check className="size-5 shrink-0 text-ecto-green" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Info notice */}
              <div className="flex items-start gap-2.5 rounded-xl border-2 border-[#e5f3ff] bg-[#f5fbff] p-3 text-xs font-bold text-macaw-blue">
                <Info className="mt-0.5 size-4 shrink-0" />
                <span>
                  Phiên ôn tập này chọn ngẫu nhiên {deck ? "các từ đã học trong gói" : "các từ mới học hôm nay"} và{" "}
                  <strong>không lưu dữ liệu hay tính điểm XP</strong>.
                </span>
              </div>

              {/* Action button */}
              <Link
                href={
                  deck
                    ? `/vocabulary/practice?mode=custom&deck=${deck.slug}&count=${selectedCount}&type=${selectedPhase}`
                    : `/vocabulary/practice?mode=custom&count=${selectedCount}&type=${selectedPhase}`
                }
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "w-full justify-center text-center",
                )}
              >
                Bắt đầu ôn tập <ArrowRight />
              </Link>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
