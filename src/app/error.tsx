"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unexpected application error.", error);
  }, [error]);

  return (
    <main className="grid min-h-[70svh] place-items-center px-5 py-12 text-center">
      <div className="max-w-xl">
        <span className="mx-auto grid size-16 place-items-center rounded-xl border-2 border-[#ffd0d0] bg-[#fff7f7] text-[#c43e3e]">
          <AlertTriangle className="size-8" />
        </span>
        <h1 className="mt-5 font-display text-3xl font-extrabold text-eel-dark-blue">
          Ứng dụng gặp sự cố tạm thời
        </h1>
        <p className="mt-3 font-bold leading-7 text-ash">
          Không thể tải nội dung lúc này. Bạn có thể thử lại; nếu lỗi tiếp diễn, hãy kiểm tra cấu hình cơ sở dữ liệu và chạy các bước migrate, seed, verify.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={reset}>
            <RotateCcw /> Thử lại
          </Button>
          <Link href="/" className={buttonVariants({ variant: "secondary" })}>
            <Home /> Về trang chủ
          </Link>
        </div>
      </div>
    </main>
  );
}
