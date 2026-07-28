import { Settings } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export default function SettingsPage() {
  return (
    <ComingSoon
      icon={Settings}
      title="Cài đặt cá nhân đang được vun trồng"
      description="Tùy chỉnh mục tiêu ngày, giọng đọc và nhắc lịch sẽ xuất hiện trong bản cập nhật tiếp theo."
    />
  );
}
