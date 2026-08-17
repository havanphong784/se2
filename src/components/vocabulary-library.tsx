"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BookOpen, CheckCircle2, Search, Sprout } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { deckProgress, type VocabularyDeck } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

const levels = ["Tất cả", "A1", "A2"] as const;

export function VocabularyLibrary({ decks }: { decks: VocabularyDeck[] }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<(typeof levels)[number]>("Tất cả");
  const shouldReduceMotion = useReducedMotion();

  const filteredDecks = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi");
    return decks.filter(
      (deck) =>
        (level === "Tất cả" || deck.level === level) &&
        (!normalized ||
          deck.title.toLocaleLowerCase("vi").includes(normalized) ||
          deck.description.toLocaleLowerCase("vi").includes(normalized) ||
          deck.words.some(
            (word) =>
              word.term.toLowerCase().includes(normalized) ||
              word.translation.toLocaleLowerCase("vi").includes(normalized),
          )),
    );
  }, [decks, level, query]);

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor="vocabulary-search" className="relative block w-full sm:max-w-sm">
          <span className="sr-only">Tìm bộ từ hoặc từ vựng</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ash" />
          <Input
            id="vocabulary-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo chủ đề, từ vựng…"
            className="h-11 pl-10 text-sm font-bold"
          />
        </label>

        {/* Filter Pills */}
        <div className="flex gap-2" role="group" aria-label="Lọc theo trình độ">
          {levels.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={level === item}
              onClick={() => setLevel(item)}
              className={cn(
                "min-h-10 rounded-xl border-2 px-4 text-xs font-black transition-all active:translate-y-0.5",
                level === item
                  ? "border-ecto-green border-b-4 border-b-[#46a302] bg-ecto-green text-white"
                  : "border-[#e5e5e5] border-b-4 border-b-[#dedede] bg-white text-ash hover:border-macaw-blue hover:text-eel-dark-blue",
              )}
            >
              {item === "Tất cả" ? "Tất cả trình độ" : `Trình độ ${item}`}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Decks */}
      {filteredDecks.length ? (
        <motion.div
          initial={shouldReduceMotion ? false : "hidden"}
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: { staggerChildren: shouldReduceMotion ? 0 : 0.04 },
            },
          }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filteredDecks.map((deck) => {
            const progress = deckProgress(deck);
            const isCompleted = progress.percent >= 100;
            const isStarted = progress.percent > 0;

            return (
              <motion.article
                key={deck.id}
                variants={{
                  hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                className="h-full"
              >
                <Link
                  href={`/vocabulary/${deck.slug}`}
                  className={cn(
                    "group flex h-full flex-col justify-between rounded-xl border-2 border-b-4 p-5 transition-all duration-150 hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-lingot-lime/40",
                    isCompleted
                      ? "border-ecto-green border-b-[#46a302] bg-[#fbfff8]"
                      : isStarted
                        ? "border-lingot-lime border-b-[#8ed459] bg-white hover:border-ecto-green"
                        : "border-[#e5e5e5] border-b-[#dedede] bg-white hover:border-lingot-lime hover:border-b-[#8ed459]",
                  )}
                  aria-label={`Bộ từ ${deck.title}, ${deck.words.length} từ, hoàn thành ${progress.percent}%`}
                >
                  <div>
                    {/* Header: Emoji Icon + Badges */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="grid size-14 place-items-center rounded-xl border-2 border-[#eeeeee] bg-[#f9fafb] text-3xl group-hover:scale-105 group-hover:border-eel-light transition-transform">
                        {deck.emoji || "🌱"}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="neutral" className="text-[11px] font-black">
                          {deck.level}
                        </Badge>
                        {isCompleted ? (
                          <Badge className="gap-1 border-ecto-green bg-ecto-green text-[11px] font-black text-white">
                            <CheckCircle2 className="size-3.5" /> Thuộc 100%
                          </Badge>
                        ) : isStarted ? (
                          <Badge className="text-[11px] font-black">
                            {progress.percent}%
                          </Badge>
                        ) : (
                          <Badge variant="neutral" className="text-[11px] font-extrabold text-ash">
                            {deck.words.length} từ
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <h3 className="mt-4 text-[19px] font-black leading-snug text-eel-dark-blue group-hover:text-ecto-green transition-colors">
                      {deck.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-xs font-bold leading-relaxed text-charcoal/80">
                      {deck.description || "Bộ từ vựng mở rộng theo chủ đề."}
                    </p>
                  </div>

                  {/* Bottom: Progress or CTA */}
                  <div className="mt-5 border-t-2 border-[#f0f0f0] pt-3.5">
                    {isStarted ? (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-black">
                          <span className="text-ash">
                            Đã thuộc {progress.mastered}/{deck.words.length} từ
                          </span>
                          <span className="text-ecto-green tabular-nums font-black">
                            {progress.percent}%
                          </span>
                        </div>
                        <Progress value={progress.percent} className="h-2" />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs font-black text-ecto-green">
                        <span className="flex items-center gap-1.5 text-ash font-extrabold">
                          <BookOpen className="size-3.5 text-macaw-blue" /> {deck.words.length} từ mới
                        </span>
                        <span className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                          Bắt đầu <ArrowRight className="size-3.5" />
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              </motion.article>
            );
          })}
        </motion.div>
      ) : (
        <div className="mt-8 flex min-h-56 flex-col items-center justify-center rounded-xl border-2 border-b-4 border-dashed border-[#e5e5e5] border-b-[#dedede] bg-[#fbfff8] p-6 text-center">
          <span className="grid size-14 place-items-center rounded-xl border-2 border-eel-light bg-white text-ecto-green">
            <Sprout className="size-7" />
          </span>
          <h3 className="mt-3 text-lg font-black text-eel-dark-blue">Không tìm thấy bộ từ</h3>
          <p className="mt-1 text-xs font-bold text-ash">
            Thử từ khóa khác hoặc chọn xem &ldquo;Tất cả trình độ&rdquo;.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setLevel("Tất cả");
            }}
            className={buttonVariants({ variant: "outline", size: "sm", className: "mt-4" })}
          >
            Xóa bộ lọc
          </button>
        </div>
      )}
    </div>
  );
}

