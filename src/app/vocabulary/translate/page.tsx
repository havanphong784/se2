import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Languages } from "lucide-react";

import { DataSourceNotice } from "@/components/data-source-notice";
import { TranslationTool } from "@/components/translation-tool";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getPersonalImportDecks } from "@/lib/vocabulary-import-server";

export const metadata: Metadata = { title: "Dịch từ vựng" };

export default async function TranslatePage() {
  const personal = await getPersonalImportDecks();

  return (
    <div className="mx-auto w-full max-w-[1000px] px-5 py-8 md:px-8 lg:py-10">
      {!personal.available && (
        <DataSourceNotice source="demo-unconfigured" />
      )}

      <header className="mb-8 border-b-2 border-[#eeeeee] pb-6">
        <Link
          href="/vocabulary"
          className={buttonVariants({ variant: "ghost", size: "sm", className: "mb-4" })}
        >
          <ArrowLeft /> Quay lại khu vườn từ vựng
        </Link>
        <div className="flex items-center gap-3">
          <Badge>
            <Languages className="size-4" /> Tiếng Anh ↔ Tiếng Việt
          </Badge>
        </div>
        <h1 className="mt-2 font-display text-balance text-[36px] font-extrabold text-eel-dark-blue md:text-[44px]">
          Tra & dịch từ vựng
        </h1>
        <p className="mt-2 text-pretty text-base font-bold leading-7 text-ash">
          Dịch thuật 2 chiều nhanh chóng và lưu ngay các từ vựng mới vào gói từ cá nhân của bạn.
        </p>
      </header>

      <TranslationTool available={personal.available} decks={personal.decks} />
    </div>
  );
}
