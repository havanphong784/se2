"use client";

import { useState } from "react";
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
  const totalDueWeek = weekly.due.reduce((sum, n) => sum + n, 0);

  return (
    <div className="space-y-4">
      {/* Controls & Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#f0f0f0] pb-3">
        {/* Toggle buttons */}
        <div className="flex gap-1.5" role="tablist" aria-label="Chọn chế độ xem lịch ôn">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "week"}
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
            type="button"
            role="tab"
            aria-selected={mode === "month"}
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
      <div role="tabpanel">
        {mode === "week" ? (
          <WeeklyReviewCalendar {...weekly} />
        ) : (
          <MonthlyReviewCalendar
            monthLabel={monthly.monthLabel}
            startOffset={monthly.startOffset}
            days={monthly.days}
          />
        )}
      </div>
    </div>
  );
}
