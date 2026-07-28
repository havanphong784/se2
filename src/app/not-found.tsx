import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[75svh] max-w-2xl flex-col items-center justify-center px-5 text-center">
      <span className="mb-5 text-7xl" aria-hidden="true">
        🌿
      </span>
      <p className="mb-2 font-extrabold uppercase tracking-[0.08em] text-macaw-blue">
        Lạc đường rồi
      </p>
      <h1 className="font-display text-4xl font-extrabold text-eel-dark-blue md:text-5xl">
        Trang này chưa nảy mầm
      </h1>
      <p className="mt-4 max-w-lg text-pretty font-bold leading-7 text-ash">
        Có vẻ đường dẫn bạn mở không tồn tại. Quay lại khu vườn học tập nhé.
      </p>
      <Link href="/" className={buttonVariants({ className: "mt-7" })}>
        <ArrowLeft /> Về tổng quan
      </Link>
    </section>
  );
}
