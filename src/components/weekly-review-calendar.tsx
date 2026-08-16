"use client";

import { cn } from "@/lib/utils";

/**
 * Lưới 7 ô (T2–CN) cho panel "Ôn tuần này".
 * - Ô quá khứ (index < todayIndex): mờ, số từ đã ôn (`reviewed`) + nhãn "đã ôn".
 * - Ô hôm nay + tương lai (index >= todayIndex): nổi bật ecto-green,
 *   số từ đến hạn cần ôn lũy tiến (`due`) + nhãn "cần ôn".
 * - Ô hôm nay viền macaw-blue để highlight riêng.
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

        return (
          <li
            key={`${day}-${fullDates[index]}`}
            className={cn(
              "flex min-h-[88px] flex-col items-center justify-between rounded-xl border-2 p-1.5 transition-all duration-150 motion-reduce:transition-none sm:min-h-[104px] sm:p-2.5",
              isPast && "border-[#e5e5e5] bg-[#f5f5f7] text-ash",
              isToday &&
                "-translate-y-0.5 border-macaw-blue border-b-4 border-b-eel-light bg-ecto-green text-white",
              !isPast &&
                !isToday &&
                "border-ecto-green border-b-4 border-b-[#3e9602] bg-ecto-green text-white",
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
                <span className="inline-block rounded-xl bg-macaw-blue px-1.5 py-0.5 text-[10px] font-black uppercase leading-none tracking-wider text-white">
                  {day}
                </span>
              ) : (
                <span
                  className={cn(
                    "text-[11px] font-extrabold uppercase tracking-wide",
                    isPast ? "text-ash" : "text-white/90",
                  )}
                >
                  {day}
                </span>
              )}
              <span
                className={cn(
                  "text-[10px] font-bold tabular-nums",
                  isPast
                    ? "text-ash/60"
                    : isToday
                      ? "text-eel-light"
                      : "text-white/75",
                )}
              >
                {fullDates[index]}
              </span>
            </div>

            {/* Value: Word count + label */}
            <div className="my-1 flex flex-1 flex-col items-center justify-center gap-0.5">
              <span
                className={cn(
                  "tabular-nums tracking-tight leading-none",
                  isToday
                    ? "text-xl font-black text-white sm:text-2xl"
                    : isPast
                      ? "text-lg font-extrabold text-ash sm:text-xl"
                      : "text-lg font-extrabold text-white sm:text-xl",
                )}
              >
                {count > 0 ? count : isPast ? "–" : "0"}
              </span>
              <span
                className={cn(
                  "text-[9px] font-extrabold uppercase leading-none tracking-wide sm:text-[10px]",
                  isPast
                    ? "text-ash/60"
                    : isToday
                      ? "text-eel-light"
                      : "text-white/75",
                )}
              >
                {isPast ? "đã ôn" : "cần ôn"}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
