"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Search, Volume2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { VocabularyWord, WordStatus } from "@/lib/demo-data";
import { speakEnglish } from "@/lib/speech";
import { cn } from "@/lib/utils";

const filters: Array<{ value: "all" | WordStatus; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "new", label: "Chưa học" },
  { value: "learning", label: "Đang học" },
  { value: "mastered", label: "Đã thuộc" },
];

const statusConfig: Record<
  WordStatus,
  { label: string; badgeVariant: "neutral" | "blue" | "default" }
> = {
  new: { label: "Mới", badgeVariant: "neutral" },
  learning: { label: "Đang học", badgeVariant: "blue" },
  mastered: { label: "Đã thuộc", badgeVariant: "default" },
};

export function WordList({ words: initialWords }: { words: VocabularyWord[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | WordStatus>("all");
  const [words, setWords] = useState(initialWords);
  const [prevInitialWords, setPrevInitialWords] = useState(initialWords);
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set());

  // Đồng bộ state khi initialWords thay đổi reference từ ngoài
  if (initialWords !== prevInitialWords) {
    setPrevInitialWords(initialWords);
    setWords(initialWords);
  }

  // State quản lý Modal xác nhận bỏ qua từ
  const [confirmWord, setConfirmWord] = useState<VocabularyWord | null>(null);

  // Đếm theo từng trạng thái
  const counts = useMemo(() => {
    return {
      all: words.length,
      new: words.filter((w) => w.status === "new").length,
      learning: words.filter((w) => w.status === "learning").length,
      mastered: words.filter((w) => w.status === "mastered").length,
    };
  }, [words]);

  // Đóng modal bằng phím Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConfirmWord(null);
      }
    };
    if (confirmWord) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [confirmWord]);

  const markAsKnown = useCallback(
    async (wordId: string) => {
      setMarkingIds((prev) => new Set(prev).add(wordId));

      // Cập nhật giao diện trước (Optimistic UI)
      setWords((prev) =>
        prev.map((w) =>
          w.id === wordId ? { ...w, status: "mastered" as const, mastery: 100, reviewStage: 3 } : w,
        ),
      );

      try {
        const response = await fetch(`/api/words/${wordId}/mark-known`, { method: "POST" });
        if (!response.ok) {
          // Hoàn tác nếu server lỗi
          setWords((prev) =>
            prev.map((w) => {
              if (w.id !== wordId) return w;
              const original = initialWords.find((iw) => iw.id === wordId);
              return {
                ...w,
                status: original?.status ?? "new",
                mastery: original?.mastery ?? 0,
                reviewStage: original?.reviewStage ?? 0,
              };
            }),
          );
        }
      } catch {
        // Hoàn tác nếu gặp lỗi mạng
        setWords((prev) =>
          prev.map((w) => {
            if (w.id !== wordId) return w;
            const original = initialWords.find((iw) => iw.id === wordId);
            return {
              ...w,
              status: original?.status ?? "new",
              mastery: original?.mastery ?? 0,
              reviewStage: original?.reviewStage ?? 0,
            };
          }),
        );
      } finally {
        setMarkingIds((prev) => {
          const next = new Set(prev);
          next.delete(wordId);
          return next;
        });
      }
    },
    [initialWords],
  );

  const handleConfirm = () => {
    if (confirmWord) {
      markAsKnown(confirmWord.id);
      setConfirmWord(null);
    }
  };

  const filteredWords = useMemo(() => {
    const normalized = query.trim().normalize("NFC").toLocaleLowerCase("vi");
    return words.filter(
      (word) =>
        (filter === "all" || word.status === filter) &&
        (!normalized ||
          word.term.normalize("NFC").toLowerCase().includes(normalized) ||
          word.translation.normalize("NFC").toLocaleLowerCase("vi").includes(normalized)),
    );
  }, [filter, query, words]);

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-sm">
          <span className="sr-only">Tìm kiếm từ vựng</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ash" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo từ hoặc nghĩa tiếng Việt…"
            className="h-11 pl-10 text-sm font-bold"
          />
        </label>

        {/* Filter Pills with Counts */}
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Lọc trạng thái từ">
          {filters.map((item) => {
            const count = counts[item.value];
            const isActive = filter === item.value;

            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => setFilter(item.value)}
                className={cn(
                  "inline-flex min-h-10 items-center gap-1.5 rounded-xl border-2 px-3.5 text-xs font-black transition-all active:translate-y-0.5",
                  isActive
                    ? "border-macaw-blue border-b-4 border-b-[#168bc2] bg-[#f4fbff] text-macaw-blue"
                    : "border-[#e5e5e5] border-b-4 border-b-[#dedede] bg-white text-ash hover:border-macaw-blue hover:text-eel-dark-blue",
                )}
              >
                <span>{item.label}</span>
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[10px] tabular-nums font-black leading-none",
                    isActive ? "bg-macaw-blue text-white" : "bg-[#f0f0f0] text-ash",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Unified Word Table / List Container */}
      <div className="overflow-hidden rounded-xl border-2 border-b-4 border-[#e5e5e5] border-b-[#dedede] bg-white">
        {/* Table Header */}
        <div className="hidden grid-cols-12 gap-4 border-b-2 border-[#eeeeee] bg-[#fafafa] px-6 py-3 text-xs font-black uppercase tracking-wider text-ash md:grid">
          <div className="col-span-4">Từ vựng &amp; Phát âm</div>
          <div className="col-span-5">Nghĩa tiếng Việt &amp; Ví dụ</div>
          <div className="col-span-3 text-right">Tiến độ &amp; Trạng thái</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[#f0f0f0]">
          {filteredWords.map((word) => {
            const config = statusConfig[word.status];
            const isMastered = word.status === "mastered";

            return (
              <article
                key={word.id}
                className="grid gap-3 p-4.5 transition-colors hover:bg-[#fbfff8] sm:p-5 md:grid-cols-12 md:items-center md:gap-4"
              >
                {/* Column 1: Audio + English Term + Phonetic */}
                <div className="flex items-center gap-3.5 md:col-span-4">
                  <button
                    type="button"
                    onClick={() => speakEnglish(word.term, "slow")}
                    aria-label={`Nghe phát âm ${word.term}`}
                    title="Nghe phát âm chuẩn"
                    className="grid size-9 shrink-0 place-items-center rounded-xl border-2 border-[#bfe9fd] border-b-4 border-b-[#8cd2f5] bg-[#f4fbff] text-macaw-blue transition-transform hover:scale-105 active:translate-y-0.5"
                  >
                    <Volume2 className="size-4" />
                  </button>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h3 className="font-display text-lg font-black text-eel-dark-blue">
                        {word.term}
                      </h3>
                      {word.partOfSpeech?.[0] && (
                        <span className="text-[11px] font-bold italic text-ash">
                          ({word.partOfSpeech[0]})
                        </span>
                      )}
                    </div>
                    {word.phonetic && (
                      <p className="font-mono text-xs font-bold text-macaw-blue">
                        {word.phonetic}
                      </p>
                    )}
                  </div>
                </div>

                {/* Column 2: Vietnamese Translation + Example Sentence */}
                <div className="min-w-0 md:col-span-5">
                  <p className="text-base font-extrabold text-charcoal">
                    {word.translation}
                  </p>
                  {word.exampleSentence && (
                    <p className="mt-0.5 line-clamp-1 text-xs font-bold italic text-ash/80">
                      &ldquo;{word.exampleSentence}&rdquo;
                    </p>
                  )}
                </div>

                {/* Column 3: Status, Mastery Progress & Action Button */}
                <div className="flex items-center justify-between gap-3 border-t border-[#f5f5f5] pt-2 md:col-span-3 md:justify-end md:border-t-0 md:pt-0">
                  <div className="flex items-center gap-2">
                    <Progress value={word.mastery} className="h-2 w-16 sm:w-20" />
                    <span className="w-7 text-right text-[11px] font-black text-ash tabular-nums">
                      {word.mastery}%
                    </span>
                  </div>

                  <div>
                    {isMastered ? (
                      <Badge className="gap-1 border-ecto-green bg-ecto-green text-[11px] font-black text-white">
                        <CheckCircle2 className="size-3" /> Đã thuộc
                      </Badge>
                    ) : (
                      <button
                        type="button"
                        disabled={markingIds.has(word.id)}
                        onClick={() => setConfirmWord(word)}
                        title="Đánh dấu từ này là đã thuộc"
                        className="inline-flex min-h-8 items-center gap-1 rounded-xl border-2 border-b-4 border-[#e5e5e5] border-b-[#dedede] bg-white px-2.5 text-[11px] font-black text-ash transition-all hover:border-ecto-green hover:border-b-[#46a302] hover:text-[#438f0e] active:translate-y-0.5"
                      >
                        <Check className="size-3" strokeWidth={3} />
                        <span>Đã biết</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Empty State */}
        {!filteredWords.length && (
          <div className="p-12 text-center">
            <p className="font-display text-lg font-black text-eel-dark-blue">
              Không tìm thấy từ vựng nào
            </p>
            <p className="mt-1 text-xs font-bold text-ash">
              Thử từ khóa khác hoặc chuyển bộ lọc sang &ldquo;Tất cả&rdquo;.
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmWord && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-xl border-2 border-b-4 border-eel-light bg-white p-6 md:p-8">
            <button
              type="button"
              onClick={() => setConfirmWord(null)}
              className="absolute right-4 top-4 grid size-9 place-items-center rounded-xl text-ash hover:bg-[#f0f0f0]"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                <AlertTriangle className="size-6" />
              </span>
              <div>
                <h2 id="confirm-dialog-title" className="font-display text-xl font-extrabold text-eel-dark-blue">
                  Bỏ qua bài học từ này?
                </h2>
                <p className="text-xs font-bold text-ash">Cảnh báo khuynh hướng bỏ qua lộ trình</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border-2 border-[#eeeeee] bg-[#fafafa] p-3.5">
              <p className="font-extrabold text-eel-dark-blue text-base">{confirmWord.term}</p>
              <p className="text-sm font-semibold text-ash">{confirmWord.translation}</p>
            </div>

            <div className="mt-4 space-y-2 text-xs font-bold text-ash">
              <p className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">•</span>
                Từ này sẽ được đánh dấu <strong>100% Đã thuộc</strong> và không còn xuất hiện trong các phiên học mặc định.
              </p>
              <p className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">•</span>
                Việc bỏ qua nhiều từ có thể làm giảm hiệu quả học tập nếu bạn chưa thực sự nắm vững.
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmWord(null)}
                className="flex-1"
              >
                Hủy bỏ
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={handleConfirm}
                className="flex-1"
              >
                Xác nhận bỏ qua
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

