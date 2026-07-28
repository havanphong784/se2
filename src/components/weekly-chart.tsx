"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DailyActivity } from "@/lib/demo-data";

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border-2 border-eel-light bg-white px-3 py-2 text-sm font-extrabold text-charcoal">
      <p>{label}</p>
      <p className="text-[#438f0e]">{payload[0].value} từ đã ôn</p>
    </div>
  );
}

export function WeeklyChart({ data }: { data: DailyActivity[] }) {
  return (
    <div className="h-[240px] w-full" aria-label="Biểu đồ số từ đã ôn trong tuần">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#eeeeee" strokeDasharray="4 4" />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#777777", fontSize: 12, fontWeight: 800 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            tick={{ fill: "#999999", fontSize: 11, fontWeight: 700 }}
          />
          <Tooltip cursor={{ fill: "#f7fff1" }} content={<ChartTooltip />} />
          <Bar dataKey="reviewed" fill="#58cc02" radius={[8, 8, 0, 0]} maxBarSize={34} />
        </BarChart>
      </ResponsiveContainer>
      <p className="sr-only">
        {data.map((item) => `${item.day}: ${item.reviewed} từ`).join(", ")}
      </p>
    </div>
  );
}
