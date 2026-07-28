import { Mic2 } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export default function SpeakingPage() {
  return (
    <ComingSoon
      icon={Mic2}
      title="Luyện nói đang được chuẩn bị"
      description="Bài luyện phát âm, phản xạ theo tình huống và ghi âm so sánh sẽ sớm có mặt. Bạn có thể ôn từ mới trước để nói tự tin hơn."
    />
  );
}
