import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { CustomStudySession } from "@/components/custom-study-session";
import { StudySession } from "@/components/study-session";
import { getDeckResult, getLearningData } from "@/lib/data";
import { isLearnedToday, type StudyMode } from "@/lib/study";

export const metadata: Metadata = { title: "Phiên học từ vựng" };

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ deck?: string; mode?: string; count?: string; type?: string }>;
}) {
  const params = await searchParams;
  const mode: StudyMode =
    params.mode === "review" ? "review" : params.mode === "custom" ? "custom" : "learn";

  if (mode === "review") return <StudySession mode="review" />;

  // Custom mode không có deck: ôn TẤT CẢ từ học hôm nay across all decks.
  if (mode === "custom" && !params.deck) {
    const learning = await getLearningData();
    const allWords = learning.data.decks.flatMap((deck) => deck.words);
    const wordsLearnedToday = allWords.filter((word) => isLearnedToday(word.learnedAt));
    return (
      <CustomStudySession
        wordsLearnedToday={wordsLearnedToday}
        countParam={params.count}
        typeParam={params.type}
      />
    );
  }

  if (!params.deck) redirect("/vocabulary");

  const deckResult = await getDeckResult(params.deck);
  if (!deckResult.data) notFound();

  if (mode === "custom") {
    const wordsLearnedToday = deckResult.data.words.filter((word) => isLearnedToday(word.learnedAt));
    return (
      <CustomStudySession
        deck={deckResult.data}
        wordsLearnedToday={wordsLearnedToday}
        countParam={params.count}
        typeParam={params.type}
      />
    );
  }

  return <StudySession mode="learn" deck={deckResult.data} />;
}
