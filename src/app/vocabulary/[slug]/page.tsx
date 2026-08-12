import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Clock3, Leaf, Trophy } from "lucide-react";

import { DataSourceNotice } from "@/components/data-source-notice";
import { WordList } from "@/components/word-list";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getDeckResult } from "@/lib/data";
import { deckProgress } from "@/lib/demo-data";

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

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 py-8 md:px-8 lg:py-10">
      <DataSourceNotice source={deckResult.source} />
      <Link
        href="/vocabulary"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl font-extrabold text-ash hover:text-charcoal focus-visible:ring-4 focus-visible:ring-lingot-lime/40"
      >
        <ArrowLeft className="size-5" /> Tất cả bộ từ
      </Link>

      <section className="mt-5 overflow-hidden rounded-xl border-2 border-eel-light bg-[#fbfff8] p-6 md:p-8">
        <div className="grid gap-6 md:grid-cols-[auto_1fr_auto] md:items-center">
          <span className="grid size-20 place-items-center rounded-xl border-2 border-lingot-lime bg-white text-4xl md:size-24">
            {deck.emoji}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">Trình độ {deck.level}</Badge>
              <Badge variant="blue">{deck.words.length} từ</Badge>
            </div>
            <h1 className="mt-3 font-display text-balance text-[36px] font-extrabold leading-[1.08] text-eel-dark-blue md:text-[48px]">
              {deck.title}
            </h1>
            <p className="mt-3 max-w-2xl text-pretty font-bold leading-7 text-ash">{deck.description}</p>
          </div>
          <Link
            href={`/vocabulary/practice?deck=${deck.slug}`}
            className={buttonVariants({ size: "lg", className: "w-full md:w-auto" })}
          >
            Học ngay <ArrowRight />
          </Link>
        </div>
      </section>

      <section aria-label="Tiến độ bộ từ" className="grid border-b-2 border-[#eeeeee] sm:grid-cols-3">
        <div className="flex items-center gap-3 py-5 sm:border-r-2 sm:border-[#eeeeee] sm:px-5 sm:first:pl-0">
          <Leaf className="size-5 text-ecto-green" />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.07em] text-ash">Tiến độ</p>
            <div className="mt-1 flex items-center gap-3">
              <Progress value={progress.percent} className="h-2.5 w-24" />
              <strong className="tabular-nums text-eel-dark-blue">{progress.percent}%</strong>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t-2 border-[#eeeeee] py-5 sm:border-r-2 sm:border-t-0 sm:px-5">
          <Trophy className="size-5 text-[#b47b00]" />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.07em] text-ash">Đã thuộc</p>
            <p className="mt-1 font-extrabold text-eel-dark-blue">{progress.mastered}/{deck.words.length} từ</p>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t-2 border-[#eeeeee] py-5 sm:border-t-0 sm:px-5">
          <Clock3 className="size-5 text-macaw-blue" />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.07em] text-ash">Thời lượng</p>
            <p className="mt-1 font-extrabold text-eel-dark-blue">Khoảng 5 phút</p>
          </div>
        </div>
      </section>

      <section className="pt-9" aria-labelledby="word-list-title">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-macaw-blue">Nội dung</p>
            <h2 id="word-list-title" className="mt-1 font-display text-[30px] font-extrabold text-eel-dark-blue">
              Danh sách từ
            </h2>
          </div>
          <span className="hidden items-center gap-2 text-sm font-extrabold text-ash sm:inline-flex">
            <BookOpen className="size-4" /> Chạm loa để nghe
          </span>
        </div>
        <WordList words={deck.words} />
      </section>
    </div>
  );
}
