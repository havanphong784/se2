import Link from "next/link";
import {
  ArrowRight,
  Construction,
  type LucideIcon,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ComingSoonProps = {
  description: string;
  icon: LucideIcon;
  title: string;
};

export function ComingSoon({
  description,
  icon: Icon,
  title,
}: ComingSoonProps) {
  return (
    <section
      aria-labelledby="coming-soon-title"
      className="mx-auto flex min-h-[calc(100svh-8rem)] w-full max-w-3xl items-center px-4 py-12 sm:px-6 sm:py-16"
    >
      <div className="w-full border-y-2 border-eel-light py-10 text-center sm:py-14">
        <div
          aria-hidden="true"
          className="mx-auto mb-6 grid size-20 place-items-center rounded-xl border-2 border-macaw-blue border-b-4 border-b-[#168dcc] bg-white text-macaw-blue sm:size-24"
        >
          <Icon className="size-10 sm:size-12" strokeWidth={2.4} />
        </div>

        <p className="mx-auto mb-4 inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-eel-light px-4 text-sm font-bold uppercase tracking-[0.08em] text-eel-dark-blue">
          <Construction aria-hidden="true" className="size-4" />
          Đang phát triển
        </p>

        <h1
          id="coming-soon-title"
          className="font-display mx-auto max-w-2xl text-balance text-4xl font-extrabold leading-tight text-eel-dark-blue sm:text-5xl"
        >
          {title}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-7 text-charcoal sm:text-lg">
          {description}
        </p>

        <div className="mt-8 flex flex-col items-center gap-4">
          <Link
            href="/vocabulary"
            className={cn(
              buttonVariants(),
              "border-b-4 text-midnight focus-visible:ring-eel-dark-blue motion-reduce:transition-none",
            )}
          >
            Học từ vựng ngay
            <ArrowRight aria-hidden="true" className="size-5" />
          </Link>
          <p className="text-sm font-medium text-charcoal">
            Trong lúc chờ, bạn vẫn có thể tiếp tục chuỗi học mỗi ngày.
          </p>
        </div>
      </div>
    </section>
  );
}
