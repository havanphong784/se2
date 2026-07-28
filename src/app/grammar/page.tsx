import { BookOpenText } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export default function GrammarPage() {
  return (
    <ComingSoon
      icon={BookOpenText}
      title="Ngữ pháp đang được biên soạn"
      description="Các chủ điểm ngữ pháp ngắn gọn, ví dụ dễ nhớ và bài tập áp dụng đang được chuẩn bị. Phần học từ vựng vẫn luôn sẵn sàng cho bạn."
    />
  );
}
