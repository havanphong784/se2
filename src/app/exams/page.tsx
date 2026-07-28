import { ClipboardCheck } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export default function ExamsPage() {
  return (
    <ComingSoon
      icon={ClipboardCheck}
      title="Kho đề đang được hoàn thiện"
      description="Đề luyện theo cấp độ, chế độ bấm giờ và phần giải thích đáp án đang được biên soạn để giúp bạn kiểm tra tiến bộ rõ ràng hơn."
    />
  );
}
