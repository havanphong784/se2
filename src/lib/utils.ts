import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const VN_TZ = "Asia/Ho_Chi_Minh";

export const VN_WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/**
 * Trả key ngày dạng `YYYY-MM-DD` theo múi giờ Việt Nam (Asia/Ho_Chi_Minh).
 * Match cột `daily_activity.activity_date` (drizzle `date` mode string).
 * Dùng cho streak + weekly calendar thay vì UTC key trước đây.
 */
export function vnDateKey(date = new Date()): string {
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: VN_TZ }).format(date);
}

/**
 * Trả 7 `Date` theo múi giờ VN, từ 6 ngày trước đến hôm nay (cũ → mới),
 * đã snap về 00:00 UTC để tiện query/giống helper cũ.
 */
export function vnWeekDates(): Date[] {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const today = new Date(Date.UTC(get("year"), get("month") - 1, get("day")));

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (6 - index));
    return date;
  });
}

/**
 * Trả key ngày `YYYY-MM-DD` cho `offset` ngày tính từ hôm nay theo múi giờ VN
 * (offset âm = quá khứ, 0 = hôm nay, dương = tương lai).
 */
export function vnDateKeyOffset(offset: number, base = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const anchor = new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
  anchor.setUTCDate(anchor.getUTCDate() + offset);
  return anchor.toISOString().slice(0, 10);
}

/** Trả `dd/MM` cho một `Date` (lấy phần UTC). */
export function vnDayLabel(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Weekday ngắn CN–T7 cho `Date` (lấy phần UTC). */
export function vnWeekdayLabel(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  return VN_WEEKDAYS[date.getUTCDay()];
}

/**
 * Trả 7 `Date` theo tuần lịch VN (T2–CN) chứa ngày `base`, từ T2 đến CN
 * (cũ → mới), snap 00:00 UTC. Dùng cho panel "ôn tuần này": ô quá khứ
 * hiển thị số đã ôn, ô hôm nay/tương lai hiển thị số từ cần ôn lũy tiến.
 */
export function vnCalendarWeek(base = new Date()): Date[] {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const today = new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
  const diffToMonday = (today.getUTCDay() + 6) % 7;
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - diffToMonday);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return date;
  });
}

/**
 * Trả danh sách các ngày trong tháng theo lịch VN và offset thứ trong tuần (T2=0, CN=6).
 */
export function vnCalendarMonth(base = new Date()): {
  days: Date[];
  startOffset: number;
  monthLabel: string;
  year: number;
  month: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const year = get("year");
  const month = get("month");

  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startOffset = (firstDay.getUTCDay() + 6) % 7;

  const days = Array.from({ length: totalDays }, (_, index) => {
    return new Date(Date.UTC(year, month - 1, index + 1));
  });

  const monthLabel = `Tháng ${String(month).padStart(2, "0")}/${year}`;

  return { days, startOffset, monthLabel, year, month };
}
