import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Brain, CheckCircle2, Leaf, Sparkles } from "lucide-react";

import { DataSourceNotice } from "@/components/data-source-notice";
import { WordList } from "@/components/word-list";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getDeckResult } from "@/lib/data";
import { deckProgress } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type DeckPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: DeckPageProps): Promise<Metadata> {
  const deckResult = await getDeckResult((await params).slug);
  return { title: deckResult.data?.title ?? "Bộ từ" };
}

export default async function DeckPage({ params }: DeckPageProps) {
  const deckResult = await getDeckResult((await params).slug);
  const deck = deckResult.data;
  if (!deck) notFound();
  const progress = deckProgress(deck);
  const isCompleted = progress.percent >= 100;
  const isStarted = progress.percent > 0;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 py-8 md:px-8 lg:py-12">
      <DataSourceNotice source={deckResult.source} />

      {/* Back button */}
      <div className="mb-6">
        <Link
          href="/vocabulary"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border-2 border-b-4 border-[#e5e5e5] border-b-[#dedede] bg-white px-3.5 text-xs font-black text-ash transition-all hover:border-macaw-blue hover:text-eel-dark-blue active:translate-y-0.5"
        >
          <ArrowLeft className="size-4" /> Tất cả bộ từ
        </Link>
      </div>

      {/* Hero Banner for the Deck */}
      <section className="relative overflow-hidden rounded-xl border-2 border-b-4 border-eel-light border-b-[#c4f0a0] bg-[#fbfff8] p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="grid size-20 shrink-0 place-items-center rounded-xl border-2 border-b-4 border-lingot-lime border-b-[#8ed459] bg-white text-4xl sm:size-24 sm:text-5xl">
              {deck.emoji || "🌱"}
            </span>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral" className="text-xs font-black">
                  Trình độ {deck.level}
                </Badge>
                <Badge variant="blue" className="text-xs font-black">
                  {deck.words.length} từ vựng
                </Badge>
                {isCompleted && (
                  <Badge className="gap-1 border-ecto-green bg-ecto-green text-xs font-black text-white">
                    <CheckCircle2 className="size-3.5" /> Hoàn thành
                  </Badge>
                )}
              </div>

              <h1 className="mt-3 font-display text-balance text-[32px] font-extrabold leading-[1.1] text-eel-dark-blue md:text-[42px]">
                {deck.title}
              </h1>
              <p className="mt-2 max-w-xl text-pretty text-sm font-bold leading-relaxed text-charcoal sm:text-base">
                {deck.description}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <Link
              href={`/vocabulary/practice?mode=learn&deck=${deck.slug}`}
              className={buttonVariants({
                size: "lg",
                className: "w-full shadow-none md:w-auto",
              })}
            >
              <span>{isStarted ? "Tiếp tục học" : "Bắt đầu học"}</span> <ArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {/* High-contrast metrics row */}
      <section aria-label="Tiến độ bộ từ" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3.5 rounded-xl border-2 border-b-4 border-lingot-lime border-b-[#8ed459] bg-[#f7fff1] p-4">
          <span className="grid size-11 place-items-center rounded-lg bg-white border border-lingot-lime text-ecto-green shrink-0">
            <Leaf className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#438f0e]">Tiến độ học</p>
            <div className="mt-1 flex items-center gap-2.5">
              <Progress value={progress.percent} className="h-2 flex-1" />
              <strong className="text-sm font-black text-[#438f0e] tabular-nums">
                {progress.percent}%
              </strong>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-xl border-2 border-b-4 border-macaw-blue border-b-[#168bc2] bg-[#f4fbff] p-4">
          <span className="grid size-11 place-items-center rounded-lg bg-white border border-macaw-blue text-macaw-blue shrink-0">
            <Brain className="size-5" />
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-macaw-blue">Đã thuộc</p>
            <strong className="text-xl font-black text-eel-dark-blue tabular-nums">
              {progress.mastered} <span className="text-xs font-bold text-ash">/ {deck.words.length} từ</span>
            </strong>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-xl border-2 border-b-4 border-[#e5e5e5] border-b-[#dedede] bg-white p-4">
          <span className="grid size-11 place-items-center rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-ash shrink-0">
            <Sparkles className="size-5" />
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-ash">Chưa thuộc</p>
            <strong className="text-xl font-black text-eel-dark-blue tabular-nums">
              {deck.words.length - progress.mastered} <span className="text-xs font-bold text-ash">từ</span>
            </strong>
          </div>
        </div>
      </section>

      {/* Word List section */}
      <section className="mt-12" aria-labelledby="word-list-title">
        <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-macaw-blue">
              Từ vựng trong chủ đề
            </p>
            <h2 id="word-list-title" className="mt-1 font-display text-[28px] font-extrabold text-eel-dark-blue sm:text-[32px]">
              Danh sách từ ({deck.words.length})
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-ash">
            <BookOpen className="size-4 text-macaw-blue" /> Nhấn biểu tượng loa để nghe phát âm
          </span>
        </div>

        <WordList words={deck.words} />
      </section>
    </div>
  );
}

