"use client";

import { cn } from "@/lib/utils";

/**
 * Lưới 7 ô (T2–CN) cho panel "Ôn tuần này".
 * - Ô quá khứ (index < todayIndex): mờ (grey), số từ đã ôn (`reviewed`) + nhãn "đã ôn".
 * - Ô hôm nay (index === todayIndex): xanh nổi bật ecto-green + viền macaw-blue,
 *   số từ đến hạn ngày đó (`due`) + nhãn "cần ôn".
 * - Ô tương lai (index > todayIndex): xanh nhạt lingot-lime, số từ đến hạn ngày đó (`due`).
 *
 * Dữ liệu do server truyền vào (đã tính theo tuần lịch VN), component chỉ render.
 */
export type WeeklyReviewCalendarProps = {
  days: string[];
  fullDates: string[];
  reviewed: number[];
  due: number[];
  todayIndex: number;
};

export function WeeklyReviewCalendar({
  days,
  fullDates,
  reviewed,
  due,
  todayIndex,
}: WeeklyReviewCalendarProps) {
  return (
    <ul className="grid grid-cols-7 gap-1.5 sm:gap-2.5" aria-label="Lịch ôn tuần này">
      {days.map((day, index) => {
        const isPast = index < todayIndex;
        const isToday = index === todayIndex;
        const count = isPast ? reviewed[index] : due[index];
        const hasCount = count > 0;

        return (
          <li
            key={`${day}-${fullDates[index]}`}
            className={cn(
              "flex min-h-[88px] flex-col items-center justify-between rounded-xl border-2 border-b-4 p-1.5 transition-all duration-150 motion-reduce:transition-none sm:min-h-[104px] sm:p-2.5",
              isPast &&
                (hasCount
                  ? "border-lingot-lime border-b-[#8ed459] bg-white text-charcoal"
                  : "border-[#e5e5e5] border-b-[#dedede] bg-[#fafafa] text-ash/70"),
              isToday &&
                "-translate-y-0.5 border-ecto-green border-b-[#46a302] bg-ecto-green text-white",
              !isPast &&
                !isToday &&
                (hasCount
                  ? "border-macaw-blue border-b-[#168bc2] bg-[#f4fbff] text-eel-dark-blue"
                  : "border-[#e5e5e5] border-b-[#dedede] bg-white text-charcoal"),
            )}
            aria-label={
              isToday
                ? `Hôm nay ${fullDates[index]}: ${count} từ cần ôn`
                : isPast
                  ? `${fullDates[index]}: đã ôn ${count} từ`
                  : `${fullDates[index]}: ${count} từ cần ôn`
            }
          >
            {/* Header: Weekday + Date */}
            <div className="flex w-full flex-col items-center gap-0.5 text-center">
              {isToday ? (
                <span className="inline-block rounded-lg bg-white/20 px-1.5 py-0.5 text-[10px] font-black uppercase leading-none tracking-wider text-white">
                  {day}
                </span>
              ) : (
                <span
                  className={cn(
                    "text-[11px] font-extrabold uppercase tracking-wide",
                    isPast
                      ? hasCount
                        ? "text-[#438f0e]"
                        : "text-ash"
                      : hasCount
                        ? "text-macaw-blue"
                        : "text-eel-dark-blue",
                  )}
                >
                  {day}
                </span>
              )}
              <span
                className={cn(
                  "text-[10px] font-bold tabular-nums",
                  isToday
                    ? "text-white/90"
                    : isPast
                      ? "text-ash/70"
                      : "text-ash",
                )}
              >
                {fullDates[index]}
              </span>
            </div>

            {/* Value: Word count + label */}
            <div className="my-1 flex flex-1 flex-col items-center justify-center gap-0.5">
              {hasCount ? (
                <>
                  <span
                    className={cn(
                      "tabular-nums tracking-tight leading-none",
                      isToday
                        ? "text-xl font-black text-white sm:text-2xl"
                        : isPast
                          ? "text-lg font-black text-[#438f0e] sm:text-xl"
                          : "text-lg font-black text-macaw-blue sm:text-xl",
                    )}
                  >
                    {count}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] font-extrabold uppercase leading-none tracking-wide sm:text-[10px]",
                      isToday
                        ? "text-white/90"
                        : isPast
                          ? "text-[#438f0e]/70"
                          : "text-macaw-blue/70",
                    )}
                  >
                    {isPast ? "đã ôn" : "cần ôn"}
                  </span>
                </>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
