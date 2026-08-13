"use client";

import { useState } from "react";
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
  deck: VocabularyDeck;
  wordsLearnedToday: VocabularyWord[];
};

export function CustomPracticeDialog({
  deck,
  wordsLearnedToday,
}: CustomPracticeDialogProps) {
  const [open, setOpen] = useState(false);
  const totalToday = wordsLearnedToday.length;

  const countOptions = [5, 10, 15, 20].filter((c) => c < totalToday);
  const [selectedCount, setSelectedCount] = useState<number | "all">(
    countOptions[0] ?? "all",
  );
  const [selectedPhase, setSelectedPhase] = useState<StudyPhase>("flashcard");

  if (totalToday === 0) {
    return (
      <Button
        variant="secondary"
        size="lg"
        disabled
        className="w-full opacity-60 md:w-auto"
      >
        <RotateCcw className="size-5" /> Ôn từ mới học (0)
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
        <RotateCcw className="size-5" /> Ôn từ mới học hôm nay ({totalToday})
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border-2 border-eel-light bg-white p-6 shadow-2xl md:p-8">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 grid size-9 place-items-center rounded-xl text-ash hover:bg-[#f0f0f0]"
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
                <h2 className="font-display text-2xl font-extrabold text-eel-dark-blue">
                  Ôn lại từ mới học hôm nay
                </h2>
              </div>
            </div>

            <p className="mt-3 text-sm font-bold text-ash">
              Bộ từ: <strong className="text-charcoal">{deck.title}</strong> •
              Có {totalToday} từ vừa học hôm nay.
            </p>

            <div className="mt-6 space-y-5">
              {/* Option 1: Word Count */}
              <div>
                <label className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-ash">
                  1. Số lượng từ ôn tập
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {countOptions.map((count) => (
                    <button
                      key={count}
                      type="button"
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
                    onClick={() => setSelectedCount("all")}
                    className={cn(
                      "flex min-h-12 flex-col items-center justify-center rounded-xl border-2 border-b-4 font-extrabold transition",
                      selectedCount === "all"
                        ? "border-macaw-blue bg-[#f0f7ff] text-macaw-blue"
                        : "border-[#dedede] bg-white text-ash hover:border-macaw-blue",
                    )}
                  >
                    Tất cả ({totalToday})
                  </button>
                </div>
              </div>

              {/* Option 2: Practice Type */}
              <div>
                <label className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-ash">
                  2. Chọn kiểu ôn tập (1 trong 3 kiểu)
                </label>
                <div className="grid gap-2.5">
                  {phaseOptions.map((opt) => {
                    const Icon = opt.icon;
                    const selected = selectedPhase === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
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
                  Phiên ôn tập này chọn ngẫu nhiên các từ mới học hôm nay và{" "}
                  <strong>không lưu dữ liệu hay tính điểm XP</strong>.
                </span>
              </div>

              {/* Action button */}
              <a
                href={`/vocabulary/practice?mode=custom&deck=${deck.slug}&count=${selectedCount}&type=${selectedPhase}`}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "w-full justify-center text-center",
                )}
              >
                Bắt đầu ôn tập <ArrowRight />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
