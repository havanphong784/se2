"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BookOpen, CheckCircle2, Search, Sprout, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { deckProgress, type VocabularyDeck } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

const levels = ["Tất cả", "A1", "A2"] as const;

function getPlantStage(percent: number) {
  if (percent >= 80) return { icon: "🌻", stageName: "Hoa nở rộ", colorClass: "border-ecto-green text-ecto-green" };
  if (percent >= 50) return { icon: "🌿", stageName: "Cây phát triển", colorClass: "border-ecto-green text-ecto-green" };
  if (percent >= 25) return { icon: "🌱", stageName: "Mầm xanh tươi", colorClass: "border-lingot-lime text-[#438f0e]" };
  return { icon: "🌰", stageName: "Hạt mầm", colorClass: "border-[#dedede] text-ash" };
}

export function VocabularyLibrary({ decks }: { decks: VocabularyDeck[] }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<(typeof levels)[number]>("Tất cả");
  const [selectedDeck, setSelectedDeck] = useState<VocabularyDeck | null>(null);

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
          className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3"
        >
          {filteredDecks.map((deck) => {
            const progress = deckProgress(deck);
            const plantStage = getPlantStage(progress.percent);
            return (
              <motion.div
                key={deck.id}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              >
                <Card
                  onClick={() => setSelectedDeck(deck)}
                  className="group relative h-full overflow-hidden cursor-pointer transition-[border-color,transform,box-shadow] hover:-translate-y-1 hover:border-ecto-green hover:shadow-md"
                >
                  <div className="h-2 bg-eel-light group-hover:bg-ecto-green" />
                  <div className="p-5">
                    {/* Header Stage & Level */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="grid size-12 place-items-center rounded-xl border-2 border-eel-light bg-[#fbfff8] text-2xl shadow-inner">
                          {plantStage.icon}
                        </span>
                        <div>
                          <Badge variant="neutral" className="text-[11px] font-extrabold">
                            {deck.level}
                          </Badge>
                          <p className="text-[11px] font-black text-[#438f0e] mt-0.5">
                            {plantStage.stageName}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-ecto-green text-white font-extrabold text-xs">
                        {progress.percent}%
                      </Badge>
                    </div>

                    {/* Title & Description */}
                    <h3 className="mt-4 font-display text-xl font-extrabold leading-tight text-eel-dark-blue group-hover:text-ecto-green transition-colors">
                      {deck.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-xs font-bold leading-5 text-ash">
                      {deck.description || "Bộ từ vựng phong phú giúp nâng cao vốn từ."}
                    </p>

                    {/* Progress Bar */}
                    <div className="mt-4 space-y-1.5">
                      <div className="flex justify-between text-[11px] font-extrabold text-ash">
                        <span>{progress.mastered}/{deck.words.length} từ đã thuộc</span>
                        <span>{progress.percent}%</span>
                      </div>
                      <Progress value={progress.percent} />
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-4 flex items-center justify-between border-t border-[#eeeeee] pt-3 text-xs font-extrabold">
                      <span className="flex items-center gap-1.5 text-ash">
                        <BookOpen className="size-3.5 text-macaw-blue" /> {deck.words.length} từ
                      </span>
                      <span className="text-ecto-green group-hover:underline flex items-center gap-1">
                        Chi tiết <ArrowRight className="size-3.5" />
                      </span>
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

      {/* Modal Details Popup */}
      <AnimatePresence>
        {selectedDeck && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDeck(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border-2 border-eel-light bg-white p-6 shadow-2xl"
            >
              {(() => {
                const progress = deckProgress(selectedDeck);
                const plantStage = getPlantStage(progress.percent);
                const total = selectedDeck.words.length || 1;
                const masteredPct = Math.round((progress.mastered / total) * 100);
                const learningPct = Math.round((progress.learning / total) * 100);
                const freshPct = Math.max(0, 100 - masteredPct - learningPct);

                return (
                  <div className="space-y-5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 border-b-2 border-[#eeeeee] pb-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-14 place-items-center rounded-2xl border-2 border-eel-light bg-[#fbfff8] text-3xl shadow-inner">
                          {plantStage.icon}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="neutral" className="text-xs font-bold">{selectedDeck.level}</Badge>
                            <span className="text-xs font-black text-[#438f0e]">{plantStage.stageName}</span>
                          </div>
                          <h3 className="font-display text-2xl font-extrabold text-eel-dark-blue mt-0.5">
                            {selectedDeck.title}
                          </h3>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedDeck(null)}
                        className="rounded-full p-1.5 text-ash hover:bg-gray-100 transition"
                      >
                        <X className="size-5" />
                      </button>
                    </div>

                    {/* Description */}
                    <p className="text-xs font-bold leading-relaxed text-ash">
                      {selectedDeck.description || "Bộ từ vựng được xây dựng theo thuật toán lặp lại ngắt quãng SRS giúp bạn ghi nhớ hiệu quả."}
                    </p>

                    {/* Progress Breakdown */}
                    <div className="space-y-3 rounded-2xl border-2 border-[#eeeeee] bg-[#fafafa] p-4">
                      <div className="flex items-center justify-between text-xs font-extrabold text-eel-dark-blue">
                        <span>Tiến độ phát triển bộ từ</span>
                        <span className="text-base font-black text-ecto-green">{progress.percent}%</span>
                      </div>

                      <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-[#eeeeee]">
                        <div style={{ width: `${masteredPct}%` }} className="bg-ecto-green transition-all" />
                        <div style={{ width: `${learningPct}%` }} className="bg-macaw-blue transition-all" />
                        <div style={{ width: `${freshPct}%` }} className="bg-[#dcdcdc] transition-all" />
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs font-extrabold">
                        <div className="rounded-xl border border-eel-light bg-[#f7fff1] p-2.5 text-[#438f0e]">
                          <p className="text-base font-black">{progress.mastered}</p>
                          <p className="text-[11px]">Đã thuộc</p>
                        </div>
                        <div className="rounded-xl border border-[#bfe9fd] bg-[#f3fbff] p-2.5 text-[#087db4]">
                          <p className="text-base font-black">{progress.learning}</p>
                          <p className="text-[11px]">Đang học</p>
                        </div>
                        <div className="rounded-xl border border-[#eeeeee] bg-white p-2.5 text-ash">
                          <p className="text-base font-black">{progress.fresh}</p>
                          <p className="text-[11px]">Mới</p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDeck(null)}
                        className={buttonVariants({ variant: "secondary", size: "lg", className: "w-1/3 font-extrabold text-xs" })}
                      >
                        Đóng
                      </button>
                      <Link
                        href={`/vocabulary/${selectedDeck.slug}`}
                        className={buttonVariants({ size: "lg", className: "w-2/3 font-extrabold text-xs justify-center bg-ecto-green hover:bg-[#438f0e]" })}
                      >
                        Học bộ từ này <ArrowRight className="size-4 ml-1" />
                      </Link>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
