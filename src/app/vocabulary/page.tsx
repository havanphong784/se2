import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Brain, Clock3, FileUp, RotateCcw, Sparkles, Sprout } from "lucide-react";

import { DataSourceNotice } from "@/components/data-source-notice";
import { VocabularyLibrary } from "@/components/vocabulary-library";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getLearningData } from "@/lib/data";
import { getTodayStudyMinutes, isDueForReview } from "@/lib/study";
import { cn } from "@/lib/utils";

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
    <div className="mx-auto w-full max-w-[1200px] px-5 py-8 md:px-8 lg:py-10 space-y-8">
      <DataSourceNotice source={learningResult.source} />

      <header className="grid gap-6 border-b-2 border-border pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge className="gap-1.5 text-xs font-extrabold">
              <Sprout className="size-4" /> Khu vườn từ vựng
            </Badge>
            <Badge variant="neutral" className="text-xs font-bold">
              {decks.length} bộ từ vựng
            </Badge>
          </div>
          <h1 className="font-display text-balance text-[40px] font-extrabold leading-[1.08] text-eel-dark-blue md:text-[52px]">
            Gieo từ mới, nhớ thật lâu.
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-base font-bold leading-7 text-ash">
            Học theo chủ đề và chăm sóc từng mầm từ vựng đến khi hoa nở rộ.
          </p>
        </div>

        <div className="grid min-w-64 rounded-xl border-2 border-graphite bg-white sm:grid-cols-2">
          <div className="flex items-center gap-3 border-b-2 border-graphite px-4 py-3 sm:border-b-0 sm:border-r-2">
            <Brain className="size-5 shrink-0 text-ecto-green" />
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-ash">Đã thuộc</p>
              <p className="text-lg font-extrabold text-eel-dark-blue tabular-nums">{mastered} từ</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <Clock3 className="size-5 shrink-0 text-macaw-blue" />
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-ash">Hôm nay</p>
              <p className="text-lg font-extrabold text-eel-dark-blue tabular-nums">{todayMinutes} phút</p>
            </div>
          </div>
        </div>
      </header>

      <section aria-label="Công cụ học tập" className="grid gap-5 md:grid-cols-3">
        <article className={cn(
          "flex flex-col justify-between rounded-xl border-2 border-b-4 bg-white p-5",
          totalDue > 0 ? "border-ecto-green" : "border-graphite",
        )}>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className={cn(
                "grid size-12 place-items-center rounded-xl border-2",
                totalDue > 0
                  ? "border-eel-light text-ecto-green"
                  : "border-border text-ash",
              )}>
                <RotateCcw className="size-6" />
              </span>
              <Badge variant={totalDue > 0 ? "default" : "neutral"}>
                {totalDue > 0 ? `${totalDue} từ đến hạn` : "Đã hoàn thành"}
              </Badge>
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-eel-dark-blue">Ôn tập SRS</h2>
              <p className="mt-1.5 text-sm font-bold leading-6 text-ash">
                Ôn đúng thời điểm để giữ từ vựng trong trí nhớ dài hạn.
              </p>
            </div>
          </div>
          <div className="mt-5 border-t-2 border-border pt-4">
            {totalDue > 0 ? (
              <Link
                href="/vocabulary/practice?mode=review"
                className={buttonVariants({ size: "sm", className: "w-full justify-between" })}
              >
                Ôn ngay {totalDue} từ <ArrowRight className="size-4" />
              </Link>
            ) : (
              <span className={buttonVariants({
                variant: "secondary",
                size: "sm",
                className: "w-full cursor-default justify-between",
              })}>
                Không có từ đến hạn
              </span>
            )}
          </div>
        </article>

        <article className="flex flex-col justify-between rounded-xl border-2 border-b-4 border-macaw-blue bg-white p-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="grid size-12 place-items-center rounded-xl border-2 border-macaw-blue text-macaw-blue">
                <Sparkles className="size-6" />
              </span>
              <Badge variant="blue">Tra cứu &amp; Dịch</Badge>
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-eel-dark-blue">Dịch từ mới</h2>
              <p className="mt-1.5 text-sm font-bold leading-6 text-ash">
                Tra nghĩa, IPA, loại từ và lưu ngay vào bộ từ cá nhân.
              </p>
            </div>
          </div>
          <div className="mt-5 border-t-2 border-border pt-4">
            <Link
              href="/vocabulary/translate"
              className={buttonVariants({ variant: "blue", size: "sm", className: "w-full justify-between" })}
            >
              Tra từ ngay <ArrowRight className="size-4" />
            </Link>
          </div>
        </article>

        <article className="flex flex-col justify-between rounded-xl border-2 border-b-4 border-lingot-lime bg-white p-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="grid size-12 place-items-center rounded-xl border-2 border-lingot-lime text-charcoal">
                <FileUp className="size-6" />
              </span>
              <Badge variant="neutral">CSV / JSON</Badge>
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-eel-dark-blue">Nhập từ vựng</h2>
              <p className="mt-1.5 text-sm font-bold leading-6 text-ash">
                Tạo nhanh bộ từ cá nhân từ danh sách CSV hoặc JSON có sẵn.
              </p>
            </div>
          </div>
          <div className="mt-5 border-t-2 border-border pt-4">
            <Link
              href="/vocabulary/import"
              className={buttonVariants({ variant: "outline", size: "sm", className: "w-full justify-between" })}
            >
              Nhập từ vựng <ArrowRight className="size-4" />
            </Link>
          </div>
        </article>
      </section>

      {/* Vocabulary Library Grid Section */}
      <section className="pt-4" aria-labelledby="deck-library-title">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-macaw-blue">
            Khu vườn tri thức
          </p>
          <h2 id="deck-library-title" className="mt-1 font-display text-[28px] font-extrabold text-eel-dark-blue md:text-[34px]">
            Bộ từ vựng của bạn
          </h2>
        </div>
        <VocabularyLibrary decks={decks} />
      </section>
    </div>
  );
}
