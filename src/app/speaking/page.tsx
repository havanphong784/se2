import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, Mic2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Luyện nói",
  description: "Hệ 44 âm IPA British English RP, nghe mẫu, xem cấu âm và tự ghi giọng để so sánh.",
};

export default function SpeakingPage() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 py-8 md:px-8 lg:py-10">
      <header className="mb-8 flex flex-col gap-3">
        <Badge variant="blue">
          <Mic2 className="size-4" /> Luyện nói
        </Badge>
        <h1 className="font-display text-balance text-[36px] font-extrabold leading-[1.08] text-eel-dark-blue md:text-[44px]">
          Luyện phát âm theo IPA
        </h1>
        <p className="max-w-2xl text-pretty font-bold leading-7 text-ash">
          Bắt đầu với 44 âm tiếng Anh theo hệ British English RP truyền thống. Nghe mẫu, xem khẩu hình, làm cặp tối tiểu và ghi giọng để tự so sánh — không chấm điểm, không lưu bản ghi.
        </p>
      </header>

      <section aria-labelledby="ipa-card-title" className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
        <Card className="overflow-hidden">
          <div className="h-2 bg-eel-light" />
          <CardContent className="flex flex-col gap-4 p-6 md:p-8">
            <span className="grid size-14 place-items-center rounded-xl border-2 border-eel-light bg-[#fbfff8] text-2xl">
              🔊
            </span>
            <h2 id="ipa-card-title" className="font-display text-[27px] font-extrabold text-eel-dark-blue">
              Phiên âm quốc tế · 44 âm
            </h2>
            <p className="text-pretty font-bold leading-7 text-ash">
              Khám phá 12 nguyên âm đơn, 8 nguyên âm đôi và 24 phụ âm. Mỗi âm kèm định danh ngữ âm, khẩu hình, ví dụ, spelling patterns và cặp tối tiểu.
            </p>
            <Link href="/speaking/ipa" className={buttonVariants({ size: "lg", className: "self-start" })}>
              Mở bảng 44 âm <ArrowRight />
            </Link>
          </CardContent>
        </Card>

        <Card className="border-[#e5e5e5]">
          <CardContent className="flex flex-col gap-3 p-6">
            <h2 className="font-display text-[22px] font-extrabold text-eel-dark-blue">Quyền riêng tư</h2>
            <ul className="flex flex-col gap-2 text-sm font-bold text-ash">
              <li>Ghi âm chỉ nằm trong tab trình duyệt.</li>
              <li>Không tải lên máy chủ, không lưu tiến độ.</li>
              <li>Không chấm điểm hay nhận dạng giọng nói.</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="speaking-soon" className="mt-10">
        <h2 id="speaking-soon" className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.08em] text-ash">
          <BookOpen className="size-4" /> Sắp có
        </h2>
        <p className="font-bold text-ash">Bài luyện phản xạ theo tình huống sẽ ra mắt sau.</p>
      </section>
    </div>
  );
}
