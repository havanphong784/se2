import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpenText, Languages, Sparkles } from "lucide-react";

import { DataSourceNotice } from "@/components/data-source-notice";
import { TranslationTool } from "@/components/translation-tool";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getPersonalImportDecks } from "@/lib/vocabulary-import-server";

export const metadata: Metadata = { title: "Dịch từ vựng" };

export default async function TranslatePage() {
  const personal = await getPersonalImportDecks();

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 py-8 md:px-8 lg:py-10">
      {!personal.available && <DataSourceNotice source="demo-unconfigured" />}

      <header className="mb-8 border-b-2 border-[#eeeeee] pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/vocabulary"
            className={buttonVariants({ variant: "ghost", size: "sm", className: "gap-1.5 font-extrabold" })}
          >
            <ArrowLeft className="size-4" /> Quay lại khu vườn từ vựng
          </Link>
          <Badge variant="blue" className="gap-1.5">
            <Languages className="size-4" /> Tra từ &amp; Dịch thuật thông minh
          </Badge>
        </div>

        <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-balance text-[34px] font-extrabold text-eel-dark-blue md:text-[44px]">
              Dịch thuật &amp; Khám phá từ vựng
            </h1>
            <p className="mt-2 max-w-2xl text-pretty text-base font-bold leading-7 text-ash">
              Tra cứu từ vựng 2 chiều Anh ↔ Việt với phát âm chuẩn IPA, loại từ, câu ví dụ và thêm trực tiếp vào gói từ cá nhân của bạn.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border-2 border-b-4 border-[#e5e5e5] border-b-[#dedede] bg-[#fbfff8] px-4 py-3 shrink-0">
            <Sparkles className="size-5 text-ecto-green" />
            <div className="text-xs font-bold text-eel-dark-blue">
              <span className="block font-black text-[#438f0e]">Google Translate API</span>
              <span>Dịch thuật chính xác &amp; miễn phí</span>
            </div>
          </div>
        </div>
      </header>

      <TranslationTool available={personal.available} decks={personal.decks} />
    </div>
  );
}
