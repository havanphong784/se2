"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Flower,
  Flower2,
  Leaf,
  Search,
  Sprout,
  X,
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
  const [selectedDeck, setSelectedDeck] = useState<VocabularyDeck | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const activeCardRef = useRef<HTMLElement | null>(null);
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

  useEffect(() => {
    if (!selectedDeck) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedDeck(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      activeCardRef.current?.focus();
    };
  }, [selectedDeck]);

  function openDeck(deck: VocabularyDeck, trigger: HTMLElement) {
    activeCardRef.current = trigger;
    setSelectedDeck(deck);
  }

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
                  : "border-graphite bg-white text-charcoal hover:border-lingot-lime",
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
                <button
                  type="button"
                  onClick={(event) => openDeck(deck, event.currentTarget)}
                  className="group flex h-full w-full flex-col overflow-hidden rounded-xl border-2 border-graphite bg-white text-left transition-[border-color,transform] hover:-translate-y-0.5 hover:border-lingot-lime focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lingot-lime/50 motion-reduce:transform-none"
                  aria-label={`Xem chi tiết bộ từ ${deck.title}, trình độ ${deck.level}, hoàn thành ${progress.percent}%`}
                >
                  <span className="h-2 w-full bg-eel-light transition-colors group-hover:bg-lingot-lime" aria-hidden="true" />
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
                    <span className="mt-1.5 line-clamp-2 block min-h-10 text-sm font-bold leading-5 text-ash">
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

                    <span className="mt-4 flex items-center justify-between border-t-2 border-border pt-3 text-sm font-extrabold">
                      <span className="flex items-center gap-1.5 text-ash">
                        <BookOpen className="size-4 text-macaw-blue" /> {deck.words.length} từ
                      </span>
                      <span className="flex items-center gap-1 text-ecto-green group-hover:underline">
                        Xem chi tiết <ArrowRight className="size-4" />
                      </span>
                    </span>
                  </span>
                </button>
              </motion.article>
            );
          })}
        </motion.div>
      ) : (
        <div className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-graphite px-5 text-center">
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

      <AnimatePresence>
        {selectedDeck && (
          <DeckDetailsDialog
            deck={selectedDeck}
            onClose={() => setSelectedDeck(null)}
            closeButtonRef={closeButtonRef}
            shouldReduceMotion={Boolean(shouldReduceMotion)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function DeckDetailsDialog({
  deck,
  onClose,
  closeButtonRef,
  shouldReduceMotion,
}: {
  deck: VocabularyDeck;
  onClose: () => void;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
  shouldReduceMotion: boolean;
}) {
  const progress = deckProgress(deck);
  const plantStage = getPlantStage(progress.percent);
  const PlantIcon = plantStage.Icon;
  const titleId = `deck-dialog-title-${deck.id}`;
  const descriptionId = `deck-dialog-description-${deck.id}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.button
        type="button"
        aria-label="Đóng hộp thoại chi tiết bộ từ"
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-black/40"
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.97, y: shouldReduceMotion ? 0 : 8 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
        className="relative z-10 max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border-2 border-graphite bg-white p-6"
      >
        <div className="flex items-start justify-between gap-4 border-b-2 border-graphite pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "grid size-14 shrink-0 place-items-center rounded-xl border-2",
                plantStage.surfaceClassName,
              )}
              aria-hidden="true"
            >
              <PlantIcon className={cn("size-8", plantStage.iconClassName)} strokeWidth={2.4} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral">{deck.level}</Badge>
                <span className="text-xs font-extrabold text-charcoal">{plantStage.stageName}</span>
              </div>
              <h3 id={titleId} className="mt-1 text-2xl font-extrabold leading-tight text-eel-dark-blue">
                {deck.title}
              </h3>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-xl border-2 border-graphite text-charcoal transition-colors hover:border-lingot-lime focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lingot-lime/50"
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
        </div>

        <p id={descriptionId} className="mt-4 text-sm font-bold leading-6 text-ash">
          {deck.description || "Bộ từ vựng được xây dựng để giúp bạn ghi nhớ hiệu quả theo phương pháp lặp lại ngắt quãng."}
        </p>

        <div className="mt-5 rounded-xl border-2 border-graphite bg-white p-4">
          <div className="flex items-center justify-between gap-3 text-sm font-extrabold text-eel-dark-blue">
            <span>Tiến độ bộ từ</span>
            <span className="text-lg text-ecto-green tabular-nums">{progress.percent}%</span>
          </div>
          <Progress
            value={progress.percent}
            aria-label={`Tiến độ học bộ từ ${deck.title}`}
            className="mt-3"
          />

          <div className="mt-4 grid grid-cols-3 divide-x-2 divide-graphite border-2 border-graphite text-center">
            <div className="px-2 py-3">
              <p className="text-lg font-extrabold text-ecto-green">{progress.mastered}</p>
              <p className="text-xs font-bold text-ash">Đã thuộc</p>
            </div>
            <div className="px-2 py-3">
              <p className="text-lg font-extrabold text-macaw-blue">{progress.learning}</p>
              <p className="text-xs font-bold text-ash">Đang học</p>
            </div>
            <div className="px-2 py-3">
              <p className="text-lg font-extrabold text-charcoal">{progress.fresh}</p>
              <p className="text-xs font-bold text-ash">Từ mới</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className={buttonVariants({ variant: "secondary", size: "lg", className: "sm:w-1/3" })}
          >
            Đóng
          </button>
          <Link
            href={`/vocabulary/${deck.slug}`}
            className={buttonVariants({ size: "lg", className: "justify-center sm:w-2/3" })}
          >
            Học bộ từ này <ArrowRight className="size-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
