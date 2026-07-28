import { Headphones } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export default function ListeningPage() {
  return (
    <ComingSoon
      icon={Headphones}
      title="Luyện nghe sắp lên sóng"
      description="Các bài nghe theo cấp độ, phần chép chính tả và câu hỏi hiểu bài đang được hoàn thiện. Hãy xây vốn từ thật chắc để sẵn sàng nghe tốt hơn nhé."
    />
  );
}
