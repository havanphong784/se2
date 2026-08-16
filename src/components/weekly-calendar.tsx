"use client";

import type { DailyActivity } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

/**
 * Lưới 7 ô (CN–T7) hiển thị trạng thái ôn trong tuần gần nhất.
 * Ô active (có học/ôn) fill ecto-green + số từ; ô hôm nay viền macaw-blue;
 * ô nghỉ để xám. Đặt trên WeeklyChart trong Card "Nhịp học".
 *
 * Tuần luôn kết thúc tại hôm nay (xem `vnWeekDates`), nên ô cuối = hôm nay.
 * Dùng `item === lastItem` so tham chiếu để highlight, tránh lệch `dd/MM`.
 */
export function WeeklyCalendar({ data }: { data: DailyActivity[] }) {
  const lastItem = data.at(-1);

  return (
    <ul className="grid grid-cols-7 gap-2" aria-label="Lịch ôn 7 ngày gần đây">
      {data.map((item) => {
        const total = item.reviewed + item.learned;
        const isActive = total > 0;
        const isToday = item === lastItem;

        return (
          <li key={`${item.day}-${item.fullDate}`} className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-ash">
              {item.day}
            </span>
            <div
              className={cn(
                "grid aspect-square w-full place-items-center rounded-xl border-2 text-sm font-extrabold",
                isActive
                  ? "border-eel-light bg-ecto-green text-white"
                  : "border-[#eeeeee] bg-[#fafafa] text-ash",
                isToday && "ring-2 ring-macaw-blue ring-offset-1",
              )}
              aria-label={
                isToday
                  ? `Hôm nay ${item.fullDate}: ${total} từ`
                  : `${item.fullDate}: ${total} từ`
              }
            >
              {isActive ? total : "–"}
            </div>
            <span className="tabular-nums text-[10px] font-bold text-ash">{item.fullDate}</span>
          </li>
        );
      })}
    </ul>
  );
}
