"use client";

import { useCallback, useMemo, useState } from "react";
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
  { value: "new", label: "Mới" },
  { value: "learning", label: "Đang học" },
  { value: "mastered", label: "Đã thuộc" },
];

const statusLabels: Record<WordStatus, { label: string; variant: "neutral" | "blue" | "default" }> = {
  new: { label: "Mới", variant: "neutral" },
  learning: { label: "Đang học", variant: "blue" },
  mastered: { label: "Đã thuộc", variant: "default" },
};

export function WordList({ words: initialWords }: { words: VocabularyWord[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | WordStatus>("all");
  const [words, setWords] = useState(initialWords);
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set());

  // State quản lý Modal xác nhận bỏ qua từ
  const [confirmWord, setConfirmWord] = useState<VocabularyWord | null>(null);

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
            prev.map((w) =>
              w.id === wordId
                ? {
                    ...w,
                    status: initialWords.find((iw) => iw.id === wordId)?.status ?? "new",
                    mastery: initialWords.find((iw) => iw.id === wordId)?.mastery ?? 0,
                  }
                : w,
            ),
          );
        }
      } catch {
        // Hoàn tác nếu gặp lỗi mạng
        setWords((prev) =>
          prev.map((w) =>
            w.id === wordId
              ? {
                  ...w,
                  status: initialWords.find((iw) => iw.id === wordId)?.status ?? "new",
                  mastery: initialWords.find((iw) => iw.id === wordId)?.mastery ?? 0,
                }
              : w,
          ),
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
    const normalized = query.trim().toLocaleLowerCase("vi");
    return words.filter(
      (word) =>
        (filter === "all" || word.status === filter) &&
        (!normalized ||
          word.term.toLowerCase().includes(normalized) ||
          word.translation.toLocaleLowerCase("vi").includes(normalized)),
    );
  }, [filter, query, words]);

  return (
    <div>
      <div className="flex flex-col gap-4 border-b-2 border-[#eeeeee] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full lg:max-w-sm">
          <span className="sr-only">Tìm trong bộ từ</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ash" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm trong bộ từ…"
            className="pl-12"
          />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Lọc trạng thái từ">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={cn(
                "min-h-11 shrink-0 rounded-xl border-2 px-3.5 text-xs font-extrabold focus-visible:ring-4 focus-visible:ring-lingot-lime/40",
                filter === item.value
                  ? "border-macaw-blue bg-[#f3fbff] text-[#087db4]"
                  : "border-[#dedede] text-ash",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y-2 divide-[#eeeeee]">
        {filteredWords.map((word) => {
          const status = statusLabels[word.status];
          return (
            <article key={word.id} className="grid gap-4 py-5 md:grid-cols-[1.05fr_1fr_auto] md:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={() => speakEnglish(word.term, "slow")}
                  aria-label={`Nghe phát âm ${word.term}`}
                  className="shrink-0 text-macaw-blue"
                >
                  <Volume2 />
                </Button>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-extrabold text-eel-dark-blue">{word.term}</h3>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <p className="mt-1 text-sm font-bold text-ash">
                    {word.phonetic} · {word.partOfSpeech}
                  </p>
                </div>
              </div>
              <div>
                <p className="font-extrabold text-charcoal">{word.translation}</p>
                <p className="mt-1 line-clamp-1 text-sm font-semibold italic text-ash">
                  “{word.exampleSentence}”
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={word.mastery} className="h-3 w-28 md:w-36" />
                <span className="w-9 text-right text-xs font-extrabold text-ash tabular-nums">
                  {word.mastery}%
                </span>
                {word.status !== "mastered" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={markingIds.has(word.id)}
                    onClick={() => setConfirmWord(word)}
                    title="Bỏ qua từ đã thuộc trước đó"
                    className="h-8 min-h-8 shrink-0 px-2 text-[11px] font-bold text-[#888888] hover:text-charcoal border border-transparent hover:border-[#e5e5e5] hover:bg-[#f8f8f8]"
                  >
                    <Check className="size-3.5" />
                    <span className="hidden sm:inline">Bỏ qua</span>
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-ecto-green">
                    <CheckCircle2 className="size-4" />
                    <span className="hidden sm:inline">Đã thuộc</span>
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {!filteredWords.length && (
        <div className="py-14 text-center">
          <p className="text-lg font-extrabold text-eel-dark-blue">Không có từ phù hợp</p>
          <p className="mt-2 font-bold text-ash">Thử đổi từ khóa hoặc trạng thái lọc.</p>
        </div>
      )}

      {/* Confirmation Dialog Cảnh báo khuynh hướng tiêu cực khi bỏ qua bài học */}
      {confirmWord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border-2 border-eel-light bg-white p-6 shadow-2xl md:p-8">
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
                <h2 className="font-display text-xl font-extrabold text-eel-dark-blue">
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
