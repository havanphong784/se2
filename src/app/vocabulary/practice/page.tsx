import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StudySession } from "@/components/study-session";
import { getDeck, getDecks } from "@/lib/data";

export const metadata: Metadata = { title: "Phiên học từ vựng" };

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ deck?: string }>;
}) {
  const requestedSlug = (await searchParams).deck;
  const deck = requestedSlug
    ? await getDeck(requestedSlug)
    : (await getDecks())[0] ?? null;

  if (!deck) notFound();
  return <StudySession deck={deck} />;
}
