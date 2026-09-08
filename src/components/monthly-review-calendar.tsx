"use client";

import { cn } from "@/lib/utils";

export type MonthlyDayData = {
  date: string; // YYYY-MM-DD
  dayNumber: number; // 1..31
  weekday: string; // T2..CN
  reviewed: number;
  due: number;
  isPast: boolean;
  isToday: boolean;
  isFuture: boolean;
};

export type MonthlyReviewCalendarProps = {
  monthLabel: string;
  startOffset: number; // 0..6
  days: MonthlyDayData[];
};

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export function MonthlyReviewCalendar({
  monthLabel,
  startOffset,
  days,
}: MonthlyReviewCalendarProps) {
  return (
    <div className="space-y-3" aria-label={`Lịch ôn ${monthLabel}`}>
      {/* Header thứ */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-extrabold text-ash uppercase">
        {WEEKDAYS.map((wd) => (
          <span key={wd} className="py-1">
            {wd}
          </span>
        ))}
      </div>

      {/* Grid các ngày */}
      <ul className="grid grid-cols-7 gap-1 sm:gap-2">
        {/* Offset trống đầu tháng */}
        {Array.from({ length: startOffset }).map((_, i) => (
          <li
            key={`empty-${i}`}
            aria-hidden="true"
            className="min-h-[56px] sm:min-h-[68px] rounded-xl border-2 border-transparent bg-transparent opacity-0 pointer-events-none"
          />
        ))}

        {/* Các ngày trong tháng */}
        {days.map((day) => {
          const count = day.isPast ? day.reviewed : day.due;
          const hasActivity = count > 0;

          return (
            <li
              key={day.date}
              className={cn(
                "flex min-h-[56px] sm:min-h-[68px] flex-col items-center justify-between rounded-xl border-2 border-b-4 p-1.5 transition-all duration-150 motion-reduce:transition-none sm:p-2",
                day.isPast &&
                  (hasActivity
                    ? "border-lingot-lime border-b-[#8ed459] bg-white text-charcoal"
                    : "border-[#e5e5e5] border-b-[#dedede] bg-[#fafafa] text-ash/60"),
                day.isToday &&
                  "-translate-y-0.5 border-ecto-green border-b-[#46a302] bg-ecto-green text-white",
                day.isFuture &&
                  (hasActivity
                    ? "border-macaw-blue border-b-[#168bc2] bg-[#f4fbff] text-eel-dark-blue"
                    : "border-[#e5e5e5] border-b-[#dedede] bg-white text-charcoal"),
              )}
              aria-label={
                day.isToday
                  ? `Hôm nay ngày ${day.dayNumber}: ${count} từ cần ôn`
                  : day.isPast
                    ? `Ngày ${day.dayNumber}: đã ôn ${count} từ`
                    : `Ngày ${day.dayNumber}: ${count} từ cần ôn`
              }
            >
              {/* Day number */}
              <span
                className={cn(
                  "text-[10px] sm:text-xs font-black leading-none",
                  day.isToday
                    ? "text-white"
                    : day.isPast
                      ? hasActivity
                        ? "text-[#438f0e]"
                        : "text-ash"
                      : hasActivity
                        ? "text-macaw-blue"
                        : "text-eel-dark-blue",
                )}
              >
                {day.dayNumber}
              </span>

              {/* Count */}
              <div className="flex flex-1 flex-col items-center justify-center">
                {count > 0 ? (
                  <>
                    <span
                      className={cn(
                        "text-xs sm:text-sm font-black tabular-nums leading-none",
                        day.isToday
                          ? "text-white"
                          : day.isPast
                            ? "text-[#438f0e]"
                            : "text-macaw-blue",
                      )}
                    >
                      {count}
                    </span>
                    <span
                      className={cn(
                        "text-[8px] sm:text-[9px] font-extrabold uppercase leading-none tracking-tighter mt-0.5 hidden sm:inline",
                        day.isToday
                          ? "text-white/90"
                          : day.isPast
                            ? "text-[#438f0e]/70"
                            : "text-macaw-blue/70",
                      )}
                    >
                      {day.isPast ? "đã ôn" : "cần ôn"}
                    </span>
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
