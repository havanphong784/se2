import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenText, Brain, Clock3, FileUp, RotateCcw, Sparkles, Sprout } from "lucide-react";

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
    <div className="mx-auto w-full max-w-[1200px] px-5 py-8 md:px-8 lg:py-10 space-y-8">
      <DataSourceNotice source={learningResult.source} />

      {/* Header Banner */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b-2 border-[#eeeeee] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge className="gap-1.5 font-extrabold text-xs">
              <Sprout className="size-4 text-ecto-green" /> Khu vườn từ vựng
            </Badge>
            <Badge variant="neutral" className="gap-1 text-xs font-bold">
              {decks.length} bộ từ vựng
            </Badge>
          </div>
          <h1 className="font-display text-balance text-[32px] font-extrabold text-eel-dark-blue md:text-[42px]">
            Gieo từ mới, nhớ thật lâu
          </h1>
          <p className="mt-1 max-w-2xl text-pretty text-base font-bold text-ash">
            Học theo chủ đề, chăm sóc mầm cây từ vựng từ hạt mầm nhỏ thành hoa nở rộ!
          </p>
        </div>

        {/* Quick Stats */}
        <div className="flex flex-wrap gap-3 shrink-0">
          <div className="flex items-center gap-3 rounded-2xl border-2 border-[#eeeeee] bg-white px-4 py-2.5 shadow-sm">
            <span className="grid size-10 place-items-center rounded-xl border-2 border-eel-light bg-[#fbfff8] text-ecto-green">
              <Brain className="size-5" />
            </span>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-ash">Đã thuộc</p>
              <p className="text-base font-extrabold text-eel-dark-blue leading-none">{mastered} từ</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border-2 border-[#eeeeee] bg-white px-4 py-2.5 shadow-sm">
            <span className="grid size-10 place-items-center rounded-xl border-2 border-[#ffe89b] bg-[#fffdf0] text-[#b47b00]">
              <Clock3 className="size-5" />
            </span>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-ash">Hôm nay</p>
              <p className="text-base font-extrabold text-eel-dark-blue leading-none">{todayMinutes} phút</p>
            </div>
          </div>
        </div>
      </header>

      {/* 3 Main Action Feature Cards */}
      <section aria-label="Công cụ học tập" className="grid gap-5 md:grid-cols-3">
        {/* Card 1: Dịch từ mới */}
        <div className="group flex flex-col justify-between rounded-2xl border-2 border-[#eeeeee] bg-white p-5 shadow-sm transition-all hover:border-macaw-blue hover:shadow-md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="grid size-12 place-items-center rounded-xl border-2 border-[#bfe9fd] bg-[#f0f9ff] text-macaw-blue">
                <Sparkles className="size-6" />
              </span>
              <Badge variant="blue" className="text-[11px] font-bold">Tra cứu &amp; Dịch</Badge>
            </div>
            <div>
              <h3 className="font-display text-xl font-extrabold text-eel-dark-blue">
                Dịch từ mới
              </h3>
              <p className="mt-1.5 text-xs font-bold text-ash leading-relaxed">
                Tra cứu từ 2 chiều Anh - Việt, phát âm IPA, loại từ và lưu trực tiếp vào gói cá nhân.
              </p>
            </div>
          </div>
          <div className="mt-5 pt-3 border-t border-[#eeeeee]">
            <Link
              href="/vocabulary/translate"
              className={buttonVariants({ variant: "outline", size: "sm", className: "w-full justify-between font-extrabold text-xs h-10" })}
            >
              Tra từ ngay <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        {/* Card 2: Nhập từ vựng */}
        <div className="group flex flex-col justify-between rounded-2xl border-2 border-[#eeeeee] bg-white p-5 shadow-sm transition-all hover:border-ecto-green hover:shadow-md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="grid size-12 place-items-center rounded-xl border-2 border-eel-light bg-[#fbfff8] text-ecto-green">
                <FileUp className="size-6" />
              </span>
              <Badge variant="neutral" className="text-[11px] font-bold">CSV / JSON</Badge>
            </div>
            <div>
              <h3 className="font-display text-xl font-extrabold text-eel-dark-blue">
                Nhập từ vựng
              </h3>
              <p className="mt-1.5 text-xs font-bold text-ash leading-relaxed">
                Tải lên danh sách từ từ tệp CSV hoặc JSON có sẵn để tạo nhanh gói từ học tập.
              </p>
            </div>
          </div>
          <div className="mt-5 pt-3 border-t border-[#eeeeee]">
            <Link
              href="/vocabulary/import"
              className={buttonVariants({ variant: "secondary", size: "sm", className: "w-full justify-between font-extrabold text-xs h-10" })}
            >
              Nhập từ vựng <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        {/* Card 3: Ôn tập lặp lại SRS */}
        <div className={`group flex flex-col justify-between rounded-2xl border-2 p-5 shadow-sm transition-all hover:shadow-md ${totalDue > 0 ? "border-ecto-green bg-[#fbfff8]" : "border-[#eeeeee] bg-white"}`}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className={`grid size-12 place-items-center rounded-xl border-2 font-bold ${totalDue > 0 ? "border-eel-light bg-[#f7fff1] text-ecto-green" : "border-[#eeeeee] bg-[#fafafa] text-ash"}`}>
                <RotateCcw className="size-6" />
              </span>
              {totalDue > 0 ? (
                <Badge className="bg-ecto-green text-white border-0 text-[11px] font-extrabold">
                  {totalDue} từ cần ôn
                </Badge>
              ) : (
                <Badge variant="neutral" className="text-[11px] font-bold">Hoàn thành</Badge>
              )}
            </div>
            <div>
              <h3 className="font-display text-xl font-extrabold text-eel-dark-blue">
                Ôn tập lặp lại (SRS)
              </h3>
              <p className="mt-1.5 text-xs font-bold text-ash leading-relaxed">
                Thuật toán ngắt quãng nhắc nhở ôn lại đúng thời điểm để ghi nhớ từ vựng lâu dài.
              </p>
            </div>
          </div>
          <div className="mt-5 pt-3 border-t border-[#eeeeee]">
            {totalDue > 0 ? (
              <Link
                href="/vocabulary/practice?mode=review"
                className={buttonVariants({ size: "sm", className: "w-full justify-between font-extrabold text-xs h-10 bg-ecto-green hover:bg-[#438f0e]" })}
              >
                Ôn ngay {totalDue} từ <ArrowRight className="size-4" />
              </Link>
            ) : (
              <span className={buttonVariants({ variant: "secondary", size: "sm", className: "w-full justify-between font-extrabold text-xs h-10 cursor-default opacity-70" })}>
                Không có từ đến hạn
              </span>
            )}
          </div>
        </div>
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
}
