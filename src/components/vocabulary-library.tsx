"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Flower,
  Flower2,
  Leaf,
  Search,
  Sprout,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { deckProgress, type VocabularyDeck } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

const levels = ["Tất cả", "A1", "A2"] as const;

type PlantStage = {
  Icon: LucideIcon;
  stageName: string;
  iconClassName: string;
  surfaceClassName: string;
};

function getPlantStage(percent: number): PlantStage {
  if (percent >= 100) {
    return {
      Icon: Flower2,
      stageName: "Hoa nở rộ",
      iconClassName: "text-ecto-green",
      surfaceClassName: "border-ecto-green bg-white",
    };
  }
  if (percent >= 80) {
    return {
      Icon: Flower,
      stageName: "Đang nở hoa",
      iconClassName: "text-ecto-green",
      surfaceClassName: "border-eel-light bg-white",
    };
  }
  if (percent >= 50) {
    return {
      Icon: Leaf,
      stageName: "Cây phát triển",
      iconClassName: "text-ecto-green",
      surfaceClassName: "border-eel-light bg-white",
    };
  }
  if (percent > 0) {
    return {
      Icon: Sprout,
      stageName: "Mầm xanh tươi",
      iconClassName: "text-charcoal",
      surfaceClassName: "border-lingot-lime bg-white",
    };
  }
  return {
    Icon: Sprout,
    stageName: "Hạt mầm",
    iconClassName: "text-ash",
    surfaceClassName: "border-border bg-white",
  };
}

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
    <>
      <div className="mt-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <label htmlFor="vocabulary-search" className="relative block w-full md:max-w-md">
          <span className="sr-only">Tìm bộ từ hoặc từ vựng</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ash" />
          <Input
            id="vocabulary-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm bộ từ, ví dụ: du lịch…"
            className="pl-12"
          />
        </label>

        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Lọc theo trình độ">
          {levels.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={level === item}
              onClick={() => setLevel(item)}
              className={cn(
                "min-h-11 shrink-0 rounded-xl border-2 px-4 text-sm font-extrabold transition-[background-color,border-color,color,transform] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lingot-lime/50 active:translate-y-0.5",
                level === item
                  ? "border-ecto-green bg-ecto-green text-white"
                  : "border-[#e5e5e5] bg-white text-charcoal hover:border-lingot-lime",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {filteredDecks.length ? (
        <motion.div
          initial={shouldReduceMotion ? false : "hidden"}
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: { staggerChildren: shouldReduceMotion ? 0 : 0.06 },
            },
          }}
          className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filteredDecks.map((deck) => {
            const progress = deckProgress(deck);
            const plantStage = getPlantStage(progress.percent);
            const PlantIcon = plantStage.Icon;

            return (
              <motion.article
                key={deck.id}
                variants={{
                  hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 10 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: [0.23, 1, 0.32, 1] }}
                className="h-full"
              >
                <Link
                  href={`/vocabulary/${deck.slug}`}
                  className="group flex h-full w-full flex-col rounded-xl border-2 border-[#e5e5e5] bg-white text-left transition-[border-color,transform] hover:-translate-y-0.5 hover:border-lingot-lime focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lingot-lime/50 motion-reduce:transform-none"
                  aria-label={`Bộ từ ${deck.title}, trình độ ${deck.level}, hoàn thành ${progress.percent}%`}
                >
                  <span className="flex flex-1 flex-col p-5">
                    <span className="flex items-start justify-between gap-3">
                      <span className="flex items-center gap-3">
                        <span
                          className={cn(
                            "grid size-12 shrink-0 place-items-center rounded-xl border-2",
                            plantStage.surfaceClassName,
                          )}
                          aria-hidden="true"
                        >
                          <PlantIcon className={cn("size-7", plantStage.iconClassName)} strokeWidth={2.4} />
                        </span>
                        <span>
                          <Badge variant="neutral">{deck.level}</Badge>
                          <span className="mt-1 block text-xs font-extrabold text-charcoal">
                            {plantStage.stageName}
                          </span>
                        </span>
                      </span>
                      <Badge>{progress.percent}%</Badge>
                    </span>

                    <span className="mt-4 block text-xl font-extrabold leading-tight text-eel-dark-blue transition-colors group-hover:text-ecto-green">
                      {deck.title}
                    </span>
                    <span className="mt-1.5 line-clamp-2 block min-h-10 text-sm font-bold leading-5 text-charcoal">
                      {deck.description || "Bộ từ vựng giúp bạn mở rộng vốn từ theo chủ đề."}
                    </span>

                    <span className="mt-4 block space-y-2">
                      <span className="flex justify-between text-xs font-extrabold text-ash">
                        <span>{progress.mastered}/{deck.words.length} từ đã thuộc</span>
                        <span className="tabular-nums">{progress.percent}%</span>
                      </span>
                      <Progress
                        value={progress.percent}
                        aria-label={`Tiến độ học bộ từ ${deck.title}`}
                      />
                    </span>

                    <span className="mt-4 flex items-center justify-between border-t-2 border-[#eeeeee] pt-3 text-sm font-extrabold">
                      <span className="flex items-center gap-1.5 text-ash">
                        <BookOpen className="size-4 text-macaw-blue" /> {deck.words.length} từ
                      </span>
                      <span className="flex items-center gap-1 text-ecto-green group-hover:underline">
                        Học bộ từ này <ArrowRight className="size-4" />
                      </span>
                    </span>
                  </span>
                </Link>
              </motion.article>
            );
          })}
        </motion.div>
      ) : (
        <div className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#e5e5e5] bg-[#fbfff8] px-5 text-center">
          <span className="grid size-16 place-items-center rounded-xl border-2 border-eel-light text-ecto-green">
            <Sprout className="size-8" />
          </span>
          <h3 className="mt-4 text-xl font-extrabold text-eel-dark-blue">Chưa tìm thấy bộ từ</h3>
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
