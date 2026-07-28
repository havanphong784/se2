"use client";

import { useMemo, useState } from "react";
import { Search, Volume2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { VocabularyWord, WordStatus } from "@/lib/demo-data";
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

function speak(term: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(term);
  utterance.lang = "en-US";
  utterance.rate = 0.86;
  window.speechSynthesis.speak(utterance);
}

export function WordList({ words }: { words: VocabularyWord[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | WordStatus>("all");

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
            <article key={word.id} className="grid gap-4 py-5 md:grid-cols-[1.05fr_1fr_180px] md:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={() => speak(word.term)}
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
                <Progress value={word.mastery} className="h-2.5" />
                <span className="w-9 text-right text-xs font-extrabold text-ash tabular-nums">
                  {word.mastery}%
                </span>
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
    </div>
  );
}
