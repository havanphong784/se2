"use client";

import Link from "next/link";
import {
  ArrowRight,
  Brain,
  CalendarCheck,
  Clock3,
  FileUp,
  RotateCcw,
  Sparkles,
  Sprout,
  Zap,
} from "lucide-react";

import { CustomPracticeDialog } from "@/components/custom-practice-dialog";
import { DataSourceNotice } from "@/components/data-source-notice";
import { VocabularyLibrary } from "@/components/vocabulary-library";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { useLearningData } from "@/lib/hooks/use-queries";
import { getTodayStudyMinutes, isDueForReview, isLearnedToday } from "@/lib/study";
import { cn } from "@/lib/utils";

export default function VocabularyPage() {
  const { data: learningRes, isLoading } = useLearningData();

  if (isLoading || !learningRes) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-5 py-8 md:px-8 lg:py-12 animate-pulse">
        <div className="h-64 bg-gray-100 rounded-xl mb-10" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-14">
          <div className="h-44 bg-gray-100 rounded-xl" />
          <div className="h-44 bg-gray-100 rounded-xl" />
          <div className="h-44 bg-gray-100 rounded-xl" />
          <div className="h-44 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const { data: learning, source } = learningRes;
  const { decks, activity } = learning;
  const words = decks.flatMap((deck) => deck.words);
  const now = new Date();
  const totalDue = words.filter((word) => isDueForReview(word, now)).length;
  const wordsLearnedToday = words.filter((word) => isLearnedToday(word.learnedAt, now));
  const learnedTodayCount = wordsLearnedToday.length;
  const mastered = words.filter(
    (word) => word.status === "mastered" || Boolean(word.reviewCompletedAt),
  ).length;
  const totalWords = words.length;
  const todayActivity = activity.at(-1);
  const todayMinutes = getTodayStudyMinutes(todayActivity);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 py-8 md:px-8 lg:py-12">
      <DataSourceNotice source={source} />

      {/* Hero Banner: Colorful & Inviting */}
      <section
        aria-label="Giới thiệu khu vườn từ vựng"
        className="relative mb-10 overflow-hidden rounded-xl border-2 border-b-4 border-eel-light border-b-[#c4f0a0] bg-[#fbfff8] p-6 md:p-8"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="gap-1.5 border-ecto-green bg-ecto-green px-3 py-1 text-xs font-black text-white">
                <Sprout className="size-4 text-white" /> Khu vườn từ vựng
              </Badge>
              <Badge variant="blue" className="px-3 py-1 text-xs font-black">
                {decks.length} bộ từ • {totalWords} từ vựng
              </Badge>
            </div>
            <h1 className="font-display text-balance text-[34px] font-extrabold leading-[1.08] text-eel-dark-blue md:text-[44px]">
              Gieo từ mới, <span className="text-ecto-green">nhớ thật lâu.</span>
            </h1>
            <p className="mt-3 text-pretty text-[15px] font-bold leading-relaxed text-charcoal">
              Học theo chủ đề sinh động và chăm sóc từng mầm từ vựng đến khi nở hoa rực rỡ qua chu kỳ lặp lại ngắt quãng.
            </p>
          </div>

          {/* Quick Stats Banner: Colorful, clear metrics */}
          <div className="grid grid-cols-3 gap-3 sm:w-auto sm:shrink-0">
            <div className="flex min-w-[100px] flex-col items-center justify-center rounded-xl border-2 border-b-4 border-lingot-lime border-b-[#8ed459] bg-[#f7fff1] p-3.5 text-center sm:min-w-[115px]">
              <div className="flex items-center gap-1 text-ecto-green">
                <Brain className="size-4" />
                <span className="text-[11px] font-black uppercase tracking-wider text-[#438f0e]">Đã thuộc</span>
              </div>
              <strong className="mt-1 text-2xl font-black text-[#438f0e] tabular-nums sm:text-3xl">
                {mastered}
              </strong>
            </div>

            <div className="flex min-w-[100px] flex-col items-center justify-center rounded-xl border-2 border-b-4 border-macaw-blue border-b-[#168bc2] bg-[#f4fbff] p-3.5 text-center sm:min-w-[115px]">
              <div className="flex items-center gap-1 text-macaw-blue">
                <Clock3 className="size-4" />
                <span className="text-[11px] font-black uppercase tracking-wider text-macaw-blue">Hôm nay</span>
              </div>
              <strong className="mt-1 text-2xl font-black text-macaw-blue tabular-nums sm:text-3xl">
                {todayMinutes}m
              </strong>
            </div>

            <div className="flex min-w-[100px] flex-col items-center justify-center rounded-xl border-2 border-b-4 border-[#ffb020] border-b-[#d48b00] bg-[#fffaf0] p-3.5 text-center sm:min-w-[115px]">
              <div className="flex items-center gap-1 text-[#e5a000]">
                <Zap className="size-4 fill-current" />
                <span className="text-[11px] font-black uppercase tracking-wider text-[#b47b00]">Cần ôn</span>
              </div>
              <strong className="mt-1 text-2xl font-black text-[#b47b00] tabular-nums sm:text-3xl">
                {totalDue}
              </strong>
            </div>
          </div>
        </div>
      </section>

      {/* Feature / Practice Tool Cards */}
      <section aria-label="Chế độ học tập" className="mb-14">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-ecto-green">
              Chế độ luyện tập
            </p>
            <h2 className="mt-1 font-display text-[26px] font-extrabold text-eel-dark-blue sm:text-[30px]">
              Công cụ ôn luyện
            </h2>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Review Due */}
          <article
            className={cn(
              "flex flex-col justify-between rounded-xl border-2 border-b-4 p-5 transition-transform duration-150 hover:-translate-y-0.5",
              totalDue > 0
                ? "border-ecto-green border-b-[#46a302] bg-[#f7fff1]"
                : "border-[#e5e5e5] border-b-[#dedede] bg-white opacity-85",
            )}
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-12 place-items-center rounded-xl border-2 border-b-4",
                    totalDue > 0
                      ? "border-ecto-green border-b-[#46a302] bg-ecto-green text-white"
                      : "border-[#e5e5e5] border-b-[#dedede] bg-[#fafafa] text-ash",
                  )}
                >
                  <RotateCcw className="size-6" />
                </span>
                <Badge
                  variant={totalDue > 0 ? "default" : "neutral"}
                  className={cn(totalDue > 0 && "border-ecto-green bg-ecto-green text-white")}
                >
                  {totalDue > 0 ? `${totalDue} từ` : "Xong"}
                </Badge>
              </div>

              <h3 className="mt-4 text-[19px] font-black text-eel-dark-blue">Ôn từ đến hạn</h3>
              <p className="mt-1.5 text-xs font-bold leading-relaxed text-charcoal">
                Ôn các từ sắp quên theo chu kỳ ngắt quãng để nhớ lâu.
              </p>
            </div>

            <div className="mt-5 border-t-2 border-current/10 pt-3.5">
              {totalDue > 0 ? (
                <Link
                  href="/vocabulary/practice?mode=review"
                  className={buttonVariants({ size: "sm", className: "w-full justify-between" })}
                >
                  <span>Ôn ngay</span> <ArrowRight className="size-4" />
                </Link>
              ) : (
                <span
                  className={buttonVariants({
                    variant: "secondary",
                    size: "sm",
                    className: "w-full cursor-default justify-between text-ash",
                  })}
                >
                  <span>Đã ôn hết</span>
                </span>
              )}
            </div>
          </article>

          {/* Card 2: Today New Words */}
          <article
            className={cn(
              "flex flex-col justify-between rounded-xl border-2 border-b-4 p-5 transition-transform duration-150 hover:-translate-y-0.5",
              learnedTodayCount > 0
                ? "border-lingot-lime border-b-[#8ed459] bg-[#fbfff8]"
                : "border-[#e5e5e5] border-b-[#dedede] bg-white opacity-85",
            )}
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-12 place-items-center rounded-xl border-2 border-b-4",
                    learnedTodayCount > 0
                      ? "border-lingot-lime border-b-[#8ed459] bg-white text-ecto-green"
                      : "border-[#e5e5e5] border-b-[#dedede] bg-[#fafafa] text-ash",
                  )}
                >
                  <CalendarCheck className="size-6" />
                </span>
                <Badge variant={learnedTodayCount > 0 ? "default" : "neutral"}>
                  {learnedTodayCount > 0 ? `${learnedTodayCount} từ mới` : "0 từ"}
                </Badge>
              </div>

              <h3 className="mt-4 text-[19px] font-black text-eel-dark-blue">Từ mới hôm nay</h3>
              <p className="mt-1.5 text-xs font-bold leading-relaxed text-charcoal">
                Lướt nhanh từ vựng vừa học hôm nay từ mọi bộ từ.
              </p>
            </div>

            <div className="mt-5 border-t-2 border-current/10 pt-3.5">
              {learnedTodayCount > 0 ? (
                <CustomPracticeDialog wordsLearnedToday={wordsLearnedToday} />
              ) : (
                <span
                  className={buttonVariants({
                    variant: "secondary",
                    size: "sm",
                    className: "w-full cursor-default justify-between text-ash",
                  })}
                >
                  <span>Chưa học từ mới</span>
                </span>
              )}
            </div>
          </article>

          {/* Card 3: Translate & Lookup */}
          <article className="flex flex-col justify-between rounded-xl border-2 border-b-4 border-macaw-blue border-b-[#168bc2] bg-[#f4fbff] p-5 transition-transform duration-150 hover:-translate-y-0.5">
            <div>
              <div className="flex items-start justify-between gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-12 place-items-center rounded-xl border-2 border-b-4 border-macaw-blue border-b-[#168bc2] bg-macaw-blue text-white"
                >
                  <Sparkles className="size-6" />
                </span>
                <Badge variant="blue" className="border-macaw-blue bg-white text-macaw-blue">Tra cứu</Badge>
              </div>

              <h3 className="mt-4 text-[19px] font-black text-eel-dark-blue">Dịch &amp; Tra từ</h3>
              <p className="mt-1.5 text-xs font-bold leading-relaxed text-charcoal">
                Tra nghĩa 2 chiều, IPA và lưu tức thì vào gói từ cá nhân.
              </p>
            </div>

            <div className="mt-5 border-t-2 border-macaw-blue/20 pt-3.5">
              <Link
                href="/vocabulary/translate"
                className={buttonVariants({
                  variant: "blue",
                  size: "sm",
                  className: "w-full justify-between",
                })}
              >
                <span>Tra từ ngay</span> <ArrowRight className="size-4" />
              </Link>
            </div>
          </article>

          {/* Card 4: Import Vocabulary */}
          <article className="flex flex-col justify-between rounded-xl border-2 border-b-4 border-[#e5e5e5] border-b-[#dedede] bg-white p-5 transition-transform duration-150 hover:-translate-y-0.5 hover:border-[#bdbdbd]">
            <div>
              <div className="flex items-start justify-between gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-12 place-items-center rounded-xl border-2 border-b-4 border-[#d9d9d9] border-b-[#bdbdbd] bg-[#fafafa] text-charcoal"
                >
                  <FileUp className="size-6" />
                </span>
                <Badge variant="neutral">CSV / JSON</Badge>
              </div>

              <h3 className="mt-4 text-[19px] font-black text-eel-dark-blue">Nhập từ vựng</h3>
              <p className="mt-1.5 text-xs font-bold leading-relaxed text-charcoal">
                Tạo nhanh bộ từ học cá nhân bằng danh sách có sẵn.
              </p>
            </div>

            <div className="mt-5 border-t-2 border-[#eeeeee] pt-3.5">
              <Link
                href="/vocabulary/import"
                className={buttonVariants({
                  variant: "secondary",
                  size: "sm",
                  className: "w-full justify-between",
                })}
              >
                <span>Nhập danh sách</span> <ArrowRight className="size-4" />
              </Link>
            </div>
          </article>
        </div>
      </section>

      {/* Deck Library Section: Clear, roomy cards */}
      <section className="mt-14" aria-labelledby="deck-library-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-ecto-green">
              Khu vườn tri thức
            </p>
            <h2 id="deck-library-title" className="mt-1 font-display text-[30px] font-extrabold text-eel-dark-blue md:text-[36px]">
              Tất cả bộ từ vựng
            </h2>
          </div>
          <span className="text-sm font-extrabold text-ash">
            {decks.length} chủ đề có sẵn
          </span>
        </div>

        <VocabularyLibrary decks={decks} />
      </section>
    </div>
  );
}
