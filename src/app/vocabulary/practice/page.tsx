import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { StudySession } from "@/components/study-session";
import { getDeckResult } from "@/lib/data";
import type { StudyMode } from "@/lib/study";

export const metadata: Metadata = { title: "Phiên học từ vựng" };

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ deck?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const mode: StudyMode = params.mode === "review" ? "review" : "learn";

  if (mode === "review") return <StudySession mode="review" />;
  if (!params.deck) redirect("/vocabulary");

  const deckResult = await getDeckResult(params.deck);
  if (!deckResult.data) notFound();

  return <StudySession mode="learn" deck={deckResult.data} />;
}
