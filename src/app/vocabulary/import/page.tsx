import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileUp } from "lucide-react";

import { VocabularyImportForm } from "@/components/vocabulary-import-form";
import { Badge } from "@/components/ui/badge";
import { getPersonalImportDecks } from "@/lib/vocabulary-import-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Nhập từ vựng" };

export default async function VocabularyImportPage() {
  const targets = await getPersonalImportDecks().catch(() => ({
    available: false as const,
    decks: [],
  }));

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 py-8 md:px-8 lg:py-10">
      <Link href="/vocabulary" className="inline-flex min-h-11 items-center gap-2 font-extrabold text-ash hover:text-charcoal">
        <ArrowLeft className="size-5" /> Quay lại thư viện
      </Link>
      <header className="mb-8 mt-5">
        <Badge className="mb-3"><FileUp className="size-4" /> Import cá nhân</Badge>
        <h1 className="font-display text-[40px] font-extrabold leading-tight text-eel-dark-blue md:text-[52px]">Mang bộ từ của bạn vào VocaBloom.</h1>
        <p className="mt-3 max-w-3xl font-bold leading-7 text-ash">Từ trùng sẽ được bỏ qua. Bộ hệ thống không bị chỉnh sửa và tiến độ học hiện tại luôn được giữ nguyên.</p>
      </header>
      <VocabularyImportForm available={targets.available} decks={targets.decks} />
    </div>
  );
}
