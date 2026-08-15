import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenText, Brain, Clock3, FileUp, Sparkles } from "lucide-react";

import { DataSourceNotice } from "@/components/data-source-notice";
import { VocabularyLibrary } from "@/components/vocabulary-library";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getLearningData } from "@/lib/data";
import { getTodayStudyMinutes, isDueForReview } from "@/lib/study";

export const metadata: Metadata = { title: "Học từ vựng" };

export default async function VocabularyPage() {
  const learningResult = await getLearningData();
  const { decks, activity } = learningResult.data;
  const words = decks.flatMap((deck) => deck.words);
  const now = new Date();
  const totalDue = words.filter((word) => isDueForReview(word, now)).length;
  const mastered = words.filter(
    (word) => word.status === "mastered" || Boolean(word.reviewCompletedAt),
  ).length;
  const todayActivity = activity.at(-1);
  const todayMinutes = getTodayStudyMinutes(todayActivity);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 py-8 md:px-8 lg:py-10">
      <DataSourceNotice source={learningResult.source} />
      <header className="grid gap-6 border-b-2 border-[#eeeeee] pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <Badge className="mb-3">
            <BookOpenText className="size-4" /> Khu vườn từ vựng
          </Badge>
          <h1 className="font-display text-balance text-[40px] font-extrabold leading-[1.08] text-eel-dark-blue md:text-[52px]">
            Gieo từ mới, nhớ thật lâu.
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-base font-bold leading-7 text-ash">
            Học theo chủ đề, nghe phát âm và ôn đúng lúc bằng phương pháp lặp lại ngắt quãng.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/vocabulary/translate"
            className={buttonVariants({ variant: "outline", size: "lg", className: "w-full sm:w-auto" })}
          >
            <Sparkles /> Dịch từ mới
          </Link>
          <Link
            href="/vocabulary/import"
            className={buttonVariants({ variant: "secondary", size: "lg", className: "w-full sm:w-auto" })}
          >
            <FileUp /> Nhập từ vựng
          </Link>
          {totalDue > 0 ? (
            <Link
              href="/vocabulary/practice?mode=review"
              className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}
            >
              Ôn {totalDue} từ đến hạn <ArrowRight />
            </Link>
          ) : (
            <span
              className={buttonVariants({
                variant: "secondary",
                size: "lg",
                className: "w-full cursor-default sm:w-auto",
              })}
            >
              Chưa có từ đến hạn
            </span>
          )}
        </div>
      </header>

      <section aria-label="Tóm tắt tiến độ" className="grid border-b-2 border-[#eeeeee] sm:grid-cols-3">
        <div className="flex items-center gap-4 py-5 sm:border-r-2 sm:border-[#eeeeee] sm:px-5 sm:first:pl-0">
          <span className="grid size-11 place-items-center rounded-xl border-2 border-eel-light text-ecto-green">
            <Brain className="size-5" />
          </span>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-ash">Đã thuộc</p>
            <p className="mt-0.5 text-xl font-extrabold text-eel-dark-blue tabular-nums">{mastered} từ</p>
          </div>
        </div>
        <div className="flex items-center gap-4 border-t-2 border-[#eeeeee] py-5 sm:border-r-2 sm:border-t-0 sm:px-5">
          <span className="grid size-11 place-items-center rounded-xl border-2 border-[#bfe9fd] text-macaw-blue">
            <Sparkles className="size-5" />
          </span>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-ash">Đến hạn hôm nay</p>
            <p className="mt-0.5 text-xl font-extrabold text-eel-dark-blue tabular-nums">{totalDue} từ</p>
          </div>
        </div>
        <div className="flex items-center gap-4 border-t-2 border-[#eeeeee] py-5 sm:border-t-0 sm:px-5">
          <span className="grid size-11 place-items-center rounded-xl border-2 border-[#ffe89b] text-[#b47b00]">
            <Clock3 className="size-5" />
          </span>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-ash">Thời gian hôm nay</p>
            <p className="mt-0.5 text-xl font-extrabold text-eel-dark-blue tabular-nums">{todayMinutes} phút</p>
          </div>
        </div>
      </section>

      <section className="pt-8" aria-labelledby="deck-library-title">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-macaw-blue">
            Chọn chủ đề
          </p>
          <h2 id="deck-library-title" className="mt-1 font-display text-[32px] font-extrabold text-eel-dark-blue">
            Bộ từ của bạn
          </h2>
        </div>
        <VocabularyLibrary decks={decks} />
      </section>
    </div>
  );
}
