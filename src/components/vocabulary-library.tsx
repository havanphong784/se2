"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, CheckCircle2, Search, Sprout } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { deckProgress, type VocabularyDeck } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

const levels = ["Tất cả", "A1", "A2"] as const;

export function VocabularyLibrary({ decks }: { decks: VocabularyDeck[] }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<(typeof levels)[number]>("Tất cả");

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
    <>
      <div className="mt-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <label className="relative block w-full md:max-w-md">
          <span className="sr-only">Tìm bộ từ hoặc từ vựng</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ash" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm bộ từ, ví dụ: du lịch…"
            className="pl-12"
          />
        </label>

        <div className="flex gap-2" role="group" aria-label="Lọc theo trình độ">
          {levels.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={level === item}
              onClick={() => setLevel(item)}
              className={cn(
                "min-h-11 rounded-xl border-2 px-4 text-sm font-extrabold transition-[background-color,border-color,color,transform] focus-visible:ring-4 focus-visible:ring-lingot-lime/40 active:translate-y-0.5",
                level === item
                  ? "border-ecto-green bg-ecto-green text-white"
                  : "border-[#dedede] bg-white text-ash hover:border-lingot-lime hover:text-[#438f0e]",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {filteredDecks.length ? (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.06 } },
          }}
          className="mt-6 grid gap-5 md:grid-cols-2"
        >
          {filteredDecks.map((deck) => {
            const progress = deckProgress(deck);
            return (
              <motion.div
                key={deck.id}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              >
                <Card className="group h-full overflow-hidden transition-[border-color,transform] hover:-translate-y-0.5 hover:border-lingot-lime">
                  <div className="h-2 bg-eel-light group-hover:bg-ecto-green" />
                  <div className="p-5 md:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <span className="grid size-14 shrink-0 place-items-center rounded-xl border-2 border-eel-light bg-[#fbfff8] text-2xl">
                        {deck.emoji}
                      </span>
                      <div className="flex gap-2">
                        <Badge variant="neutral">{deck.level}</Badge>
                        {progress.percent >= 80 && (
                          <Badge>
                            <CheckCircle2 className="size-3.5" /> Đã nở
                          </Badge>
                        )}
                      </div>
                    </div>

                    <h2 className="mt-5 font-display text-[27px] font-extrabold leading-tight text-eel-dark-blue">
                      {deck.title}
                    </h2>
                    <p className="mt-2 min-h-12 text-pretty text-sm font-bold leading-6 text-ash">
                      {deck.description}
                    </p>

                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between text-xs font-extrabold text-ash">
                        <span>
                          {progress.mastered} thuộc · {progress.learning} đang học
                        </span>
                        <span className="tabular-nums">{progress.percent}%</span>
                      </div>
                      <Progress value={progress.percent} />
                    </div>

                    <div className="mt-6 flex items-center justify-between gap-3 border-t-2 border-[#eeeeee] pt-5">
                      <span className="inline-flex items-center gap-2 text-sm font-extrabold text-ash">
                        <BookOpen className="size-4 text-macaw-blue" /> {deck.words.length} từ
                      </span>
                      <Link
                        href={`/vocabulary/${deck.slug}`}
                        className={buttonVariants({
                          variant: progress.percent ? "outline" : "default",
                          size: "sm",
                        })}
                      >
                        {progress.percent ? "Tiếp tục" : "Bắt đầu"} <ArrowRight />
                      </Link>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      ) : (
        <div className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#dcdcdc] px-5 text-center">
          <span className="grid size-16 place-items-center rounded-xl border-2 border-eel-light text-ecto-green">
            <Sprout className="size-8" />
          </span>
          <h2 className="mt-4 text-xl font-extrabold text-eel-dark-blue">Chưa tìm thấy bộ từ</h2>
          <p className="mt-2 max-w-md font-bold text-ash">
            Thử từ khóa ngắn hơn hoặc chuyển về bộ lọc “Tất cả”.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setLevel("Tất cả");
            }}
            className={buttonVariants({ variant: "outline", className: "mt-5" })}
          >
            Xóa bộ lọc
          </button>
        </div>
      )}
    </>
  );
}
