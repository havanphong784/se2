import { AlertTriangle, Database } from "lucide-react";

import type { DataSource } from "@/lib/data";

export function DataSourceNotice({ source }: { source: DataSource }) {
  if (source === "database") return null;

  const unavailable = source === "demo-unavailable";

  return (
    <aside
      role="status"
      aria-label="Trạng thái dữ liệu"
      className={`mb-6 flex gap-3 rounded-xl border-2 p-4 font-bold leading-6 ${
        unavailable
          ? "border-[#ffd0d0] bg-[#fff7f7] text-[#9e3434]"
          : "border-[#bfe9fd] bg-[#f3fbff] text-[#087db4]"
      }`}
    >
      {unavailable ? (
        <AlertTriangle className="mt-0.5 size-5 shrink-0" />
      ) : (
        <Database className="mt-0.5 size-5 shrink-0" />
      )}
      <div>
        <p className="font-extrabold">
          {unavailable ? "Cơ sở dữ liệu đang tạm thời không truy cập được" : "Đang chạy ở chế độ demo"}
        </p>
        <p className="mt-1 text-sm">
          {unavailable
            ? "Bạn đang xem dữ liệu mẫu. Tiến độ học sẽ chỉ được giữ trên thiết bị và chưa đồng bộ lên máy chủ. Hãy kiểm tra DATABASE_URL rồi thử lại."
            : "DATABASE_URL chưa được cấu hình nên ứng dụng hiển thị dữ liệu mẫu. Tiến độ học không được lưu lên máy chủ."}
        </p>
      </div>
    </aside>
  );
}
