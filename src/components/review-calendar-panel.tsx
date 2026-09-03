"use client";

import { type KeyboardEvent, useRef, useState } from "react";
import { Calendar, CalendarRange } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  MonthlyReviewCalendar,
  type MonthlyDayData,
} from "@/components/monthly-review-calendar";
import {
  WeeklyReviewCalendar,
  type WeeklyReviewCalendarProps,
} from "@/components/weekly-review-calendar";
import { cn } from "@/lib/utils";

export type ReviewCalendarPanelProps = {
  weekly: WeeklyReviewCalendarProps;
  monthly: {
    monthLabel: string;
    startOffset: number;
    days: MonthlyDayData[];
    totalDueMonth: number;
  };
};

export function ReviewCalendarPanel({
  weekly,
  monthly,
}: ReviewCalendarPanelProps) {
  const [mode, setMode] = useState<"week" | "month">("week");
  const weekTabRef = useRef<HTMLButtonElement>(null);
  const monthTabRef = useRef<HTMLButtonElement>(null);
  const totalDueWeek = weekly.due.reduce((sum, due) => sum + due, 0);

  function selectTab(nextMode: "week" | "month") {
    setMode(nextMode);
    requestAnimationFrame(() => {
      (nextMode === "week" ? weekTabRef : monthTabRef).current?.focus();
    });
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    let nextMode: "week" | "month" | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      nextMode = mode === "week" ? "month" : "week";
    } else if (event.key === "Home") {
      nextMode = "week";
    } else if (event.key === "End") {
      nextMode = "month";
    }
    if (!nextMode) return;
    event.preventDefault();
    selectTab(nextMode);
  }

  return (
    <div className="space-y-4">
      {/* Controls & Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#f0f0f0] pb-3">
        {/* Toggle buttons */}
        <div className="flex gap-1.5" role="tablist" aria-label="Chọn chế độ xem lịch ôn">
          <button
            ref={weekTabRef}
            id="review-calendar-week-tab"
            type="button"
            role="tab"
            aria-selected={mode === "week"}
            aria-controls="review-calendar-week-panel"
            tabIndex={mode === "week" ? 0 : -1}
            onKeyDown={handleTabKeyDown}
            onClick={() => setMode("week")}
            className={cn(
              "flex min-h-9 items-center gap-1.5 rounded-xl border-2 px-3 text-xs font-extrabold transition",
              mode === "week"
                ? "border-macaw-blue border-b-4 border-b-[#168bc2] bg-white text-macaw-blue"
                : "border-[#e5e5e5] border-b-4 border-b-[#dedede] bg-white text-ash hover:border-macaw-blue",
            )}
          >
            <Calendar className="size-3.5" /> Tuần này
          </button>
          <button
            ref={monthTabRef}
            id="review-calendar-month-tab"
            type="button"
            role="tab"
            aria-selected={mode === "month"}
            aria-controls="review-calendar-month-panel"
            tabIndex={mode === "month" ? 0 : -1}
            onKeyDown={handleTabKeyDown}
            onClick={() => setMode("month")}
            className={cn(
              "flex min-h-9 items-center gap-1.5 rounded-xl border-2 px-3 text-xs font-extrabold transition",
              mode === "month"
                ? "border-macaw-blue border-b-4 border-b-[#168bc2] bg-white text-macaw-blue"
                : "border-[#e5e5e5] border-b-4 border-b-[#dedede] bg-white text-ash hover:border-macaw-blue",
            )}
          >
            <CalendarRange className="size-3.5" /> {monthly.monthLabel}
          </button>
        </div>

        {/* Dynamic Badge */}
        <div>
          {mode === "week" ? (
            <Badge variant={totalDueWeek > 0 ? "default" : "neutral"}>
              {totalDueWeek > 0
                ? `${totalDueWeek} từ cần ôn tuần này`
                : "Không có từ đến hạn tuần này"}
            </Badge>
          ) : (
            <Badge variant={monthly.totalDueMonth > 0 ? "default" : "neutral"}>
              {monthly.totalDueMonth > 0
                ? `${monthly.totalDueMonth} từ cần ôn trong tháng`
                : "Không có từ đến hạn trong tháng"}
            </Badge>
          )}
        </div>
      </div>

      {/* Calendar Views */}
      {mode === "week" ? (
        <div
          id="review-calendar-week-panel"
          role="tabpanel"
          aria-labelledby="review-calendar-week-tab"
        >
          <WeeklyReviewCalendar {...weekly} />
        </div>
      ) : (
        <div
          id="review-calendar-month-panel"
          role="tabpanel"
          aria-labelledby="review-calendar-month-tab"
        >
          <MonthlyReviewCalendar
            monthLabel={monthly.monthLabel}
            startOffset={monthly.startOffset}
            days={monthly.days}
          />
        </div>
      )}
    </div>
  );
}
