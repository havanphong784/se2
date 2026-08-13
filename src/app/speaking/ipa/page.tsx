import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mic2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { IpaPracticeSession } from "@/components/speaking/ipa-practice-session";

export const metadata: Metadata = {
  title: "Bảng phiên âm quốc tế IPA · 44 Âm chuẩn British English",
  description: "Luyện phát âm 44 âm IPA British English RP, nghe mẫu, xem khẩu hình chi tiết, phân biệt cặp âm dễ nhầm và ghi âm chấm điểm.",
};

export default function IpaPracticePage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 lg:py-8">
      {/* NAVIGATION & HEADER */}
      <div className="mb-6 flex flex-col gap-3">
        <Link
          href="/speaking"
          className="inline-flex items-center gap-2 text-xs font-extrabold text-ash hover:text-charcoal transition-colors self-start"
        >
          <ArrowLeft className="size-4" /> Quay lại Luyện nói
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Badge variant="blue">
                <Mic2 className="size-3.5" /> 44 Âm IPA British English
              </Badge>
              <span className="text-xs font-bold text-ash">Dùng chung không cần đăng nhập</span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-black text-eel-dark-blue md:text-3xl">
              Bảng phiên âm quốc tế IPA
            </h1>
          </div>
        </div>
      </div>

      {/* SESSION CONTENT */}
      <IpaPracticeSession />
    </div>
  );
}
