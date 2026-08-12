import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StudySession } from "@/components/study-session";
import { getDeckResult, getDecksResult } from "@/lib/data";

export const metadata: Metadata = { title: "Phiên học từ vựng" };

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ deck?: string }>;
}) {
  const requestedSlug = (await searchParams).deck;
  const deckResult = requestedSlug
    ? await getDeckResult(requestedSlug)
    : await getDecksResult().then((result) => ({
        ...result,
        data: result.data[0] ?? null,
      }));

  if (!deckResult.data) notFound();
  return <StudySession deck={deckResult.data} dataSource={deckResult.source} />;
}
