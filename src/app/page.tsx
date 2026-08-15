import Link from "next/link";

export const dynamic = "force-dynamic";

import {
  ArrowRight,
  BookCheck,
  CalendarDays,
  Clock3,
  Flame,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";

import { DataSourceNotice } from "@/components/data-source-notice";
import { LearningPath } from "@/components/learning-path";
import { WordGardenIllustration } from "@/components/word-garden-illustration";
import { WeeklyChart } from "@/components/weekly-chart";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getLearningData } from "@/lib/data";
import { getCurrentAuthUser } from "@/lib/auth";
import { getDb } from "@/db";
import { isDueForReview } from "@/lib/study";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const db = getDb();
  const authUser = db ? await getCurrentAuthUser(db) : null;
  const displayName = authUser?.displayName ?? "Minh Anh";

  const learning = await getLearningData();
  const { decks, activity } = learning.data;
  const allWords = decks.flatMap((deck) => deck.words);
  const mastered = allWords.filter((word) => word.reviewCompletedAt).length;
  const learningCount = allWords.filter(
    (word) => word.learnedAt && !word.reviewCompletedAt,
  ).length;
  const today = activity.at(-1);
  const dailyGoal = 20;
  const learnedToday = today?.learned ?? 0;
  const goalPercent = Math.min(100, Math.round((learnedToday / dailyGoal) * 100));
  const now = new Date();
  const dueWords = allWords.filter((word) => isDueForReview(word, now));
  const activeDays = activity.filter((item) => item.reviewed > 0 || item.learned > 0).length;
  const dateLabel = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date());

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 py-8 md:px-8 lg:py-10">
      <DataSourceNotice source={learning.source} />
      <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="blue" className="mb-3">
            <CalendarDays className="size-4" /> {dateLabel}
          </Badge>
          <h1 className="font-display text-balance text-[36px] font-extrabold leading-[1.08] text-eel-dark-blue md:text-[44px]">
            Chào {displayName}, mình nở thêm vài từ nhé!
          </h1>
        </div>
        <div className="flex items-center gap-2 text-sm font-extrabold text-ash">
          <Flame className="size-5 fill-[#ffb020] text-[#ffb020]" /> Đã học {activeDays}/7 ngày gần đây
        </div>
      </header>

      <section aria-labelledby="daily-mission" className="grid gap-5 lg:grid-cols-[1.55fr_0.8fr]">
        <div className="relative overflow-hidden rounded-xl border-2 border-eel-light bg-[#fbfff8] p-6 md:min-h-[310px] md:p-8">
          <div className="relative z-10 max-w-[570px] md:pr-44">
            <Badge className="mb-4">
              <Sparkles className="size-4" /> Bài học hôm nay
            </Badge>
            <h2
              id="daily-mission"
              className="font-display text-balance text-[32px] font-extrabold leading-[1.1] text-[#438f0e] md:text-[40px]"
            >
              {dueWords.length > 0
                ? `Ôn ${dueWords.length} từ đang chờ bạn`
                : "Bạn đã ôn xong hôm nay"}
            </h2>
            <p className="mt-3 max-w-lg text-pretty font-bold leading-7 text-charcoal">
              Một phiên ngắn khoảng 5 phút. VocaBloom sẽ ưu tiên những từ bạn sắp quên.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              {dueWords.length > 0 ? (
                <Link
                  href="/vocabulary/practice?mode=review"
                  className={buttonVariants({ size: "lg" })}
                >
                  Bắt đầu ôn <ArrowRight />
                </Link>
              ) : (
                <Link href="/vocabulary" className={buttonVariants({ size: "lg" })}>
                  Khám phá bộ từ <ArrowRight />
                </Link>
              )}
              <span className="inline-flex items-center gap-2 text-sm font-extrabold text-ash">
                <Clock3 className="size-4" /> Khoảng 5 phút
              </span>
            </div>
          </div>
          <WordGardenIllustration className="mt-6 md:absolute md:-bottom-2 md:-right-3 md:mt-0 md:w-[270px]" />
        </div>

        <Card className="border-[#e5e5e5]">
          <CardHeader className="flex-row items-center justify-between gap-4 pb-2">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-ash">
                Mục tiêu hôm nay (từ mới)
              </p>
              <CardTitle className="mt-1 text-[24px]">{learnedToday}/{dailyGoal} từ mới</CardTitle>
            </div>
            <span className="grid size-12 place-items-center rounded-xl border-2 border-macaw-blue text-macaw-blue">
              <Target className="size-6" />
            </span>
          </CardHeader>
          <CardContent className="pt-3">
            <Progress value={goalPercent} aria-label={`${goalPercent}% mục tiêu ngày`} />
            <p className="mt-3 text-sm font-bold leading-6 text-ash">
              {goalPercent >= 100
                ? "Tuyệt vời! Bạn đã hoàn thành mục tiêu học từ mới hôm nay."
                : `Chỉ còn ${Math.max(0, dailyGoal - learnedToday)} từ mới để chạm mục tiêu.`}
            </p>
            <div className="mt-6 border-t-2 border-[#eeeeee] pt-5">
              <div className="flex items-center justify-between py-2">
                <span className="flex items-center gap-2 font-bold text-charcoal">
                  <BookCheck className="size-5 text-ecto-green" /> Đã thuộc
                </span>
                <strong className="tabular-nums text-eel-dark-blue">{mastered} từ</strong>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="flex items-center gap-2 font-bold text-charcoal">
                  <Sparkles className="size-5 text-macaw-blue" /> Đang học
                </span>
                <strong className="tabular-nums text-eel-dark-blue">{learningCount} từ</strong>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="flex items-center gap-2 font-bold text-charcoal">
                  <Trophy className="size-5 text-[#d49700]" /> Điểm tuần
                </span>
                <strong className="tabular-nums text-eel-dark-blue">
                  {activity.reduce((sum, item) => sum + item.xp, 0)} XP
                </strong>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]" aria-labelledby="weekly-title">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-macaw-blue">
                Nhịp học
              </p>
              <CardTitle id="weekly-title" className="mt-1 text-[24px]">
                7 ngày gần đây
              </CardTitle>
            </div>
            <Badge variant="neutral">
              {activity.reduce((sum, item) => sum + item.reviewed + item.learned, 0)} từ đã học/ôn
            </Badge>
          </CardHeader>
          <CardContent className="pt-0">
            <WeeklyChart data={activity} />
          </CardContent>
        </Card>

        <div className="rounded-xl border-2 border-macaw-blue p-5">
          <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-macaw-blue">
            Gợi ý nhỏ
          </p>
          <h2 className="mt-2 font-display text-[27px] font-extrabold leading-tight text-eel-dark-blue">
            Học ít nhưng đều sẽ nhớ lâu hơn.
          </h2>
          <p className="mt-3 text-pretty font-bold leading-7 text-ash">
            Duy trì 5–10 phút mỗi ngày hiệu quả hơn một phiên học thật dài cuối tuần.
          </p>
          <Link
            href="/vocabulary"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "mt-5 w-full border-macaw-blue border-b-[#168bc2] text-[#087db4]",
            )}
          >
            Khám phá bộ từ <ArrowRight />
          </Link>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="path-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-ecto-green">
              Khu vườn từ vựng
            </p>
            <h2 id="path-title" className="mt-1 font-display text-[32px] font-extrabold text-eel-dark-blue">
              Lộ trình của bạn
            </h2>
          </div>
          <Link
            href="/vocabulary"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl font-extrabold text-macaw-blue underline decoration-2 underline-offset-4 focus-visible:ring-4 focus-visible:ring-macaw-blue/20"
          >
            Xem tất cả <ArrowRight className="size-4" />
          </Link>
        </div>
        <LearningPath decks={decks} />
      </section>
    </div>
  );
}
