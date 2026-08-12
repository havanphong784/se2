import { and, asc, eq, gte } from "drizzle-orm";

import { getDb } from "@/db";
import { dailyActivity, decks, wordProgress, words } from "@/db/schema";
import {
  DEMO_ACTIVITY,
  DEMO_DECKS,
  type DailyActivity as ActivityItem,
  type VocabularyDeck,
  type VocabularyWord,
} from "@/lib/demo-data";
import { getDemoUser } from "@/lib/server-data";

function fallbackDecks() {
  return structuredClone(DEMO_DECKS);
}

function recentUtcDates() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (6 - index));
    return date;
  });
}

function emptyRecentActivity(): ActivityItem[] {
  const weekdays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  return recentUtcDates().map((date) => ({
    day: weekdays[date.getUTCDay()],
    fullDate: `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
    reviewed: 0,
    learned: 0,
    xp: 0,
  }));
}

export async function getDecks(): Promise<VocabularyDeck[]> {
  const db = getDb();
  if (!db) return fallbackDecks();

  try {
    const user = await getDemoUser(db);

    const rows = await db
      .select({
        deckId: decks.id,
        deckSlug: decks.slug,
        deckTitle: decks.title,
        deckDescription: decks.description,
        deckLevel: decks.level,
        wordId: words.id,
        term: words.term,
        translation: words.translation,
        phonetic: words.phonetic,
        partOfSpeech: words.partOfSpeech,
        exampleSentence: words.exampleSentence,
        exampleTranslation: words.exampleTranslation,
        status: wordProgress.status,
        mastery: wordProgress.mastery,
        intervalDays: wordProgress.intervalDays,
        nextReviewAt: wordProgress.nextReviewAt,
      })
      .from(decks)
      .innerJoin(words, eq(words.deckId, decks.id))
      .leftJoin(
        wordProgress,
        user
          ? and(
              eq(wordProgress.wordId, words.id),
              eq(wordProgress.userId, user.id),
            )
          : eq(wordProgress.id, "00000000-0000-0000-0000-000000000000"),
      )
      .orderBy(asc(decks.sortOrder), asc(words.sortOrder));

    const fallbackEmoji = new Map(DEMO_DECKS.map((deck) => [deck.slug, deck.emoji]));
    const result = new Map<string, VocabularyDeck>();

    for (const row of rows) {
      if (!result.has(row.deckId)) {
        result.set(row.deckId, {
          id: row.deckId,
          slug: row.deckSlug,
          title: row.deckTitle,
          description: row.deckDescription,
          level: row.deckLevel,
          emoji: fallbackEmoji.get(row.deckSlug) ?? "🌱",
          words: [],
        });
      }

      const item: VocabularyWord = {
        id: row.wordId,
        term: row.term,
        translation: row.translation,
        phonetic: row.phonetic,
        partOfSpeech: row.partOfSpeech,
        exampleSentence: row.exampleSentence,
        exampleTranslation: row.exampleTranslation,
        status: (row.status as VocabularyWord["status"] | null) ?? "new",
        mastery: row.mastery ?? 0,
        intervalDays: row.intervalDays ?? 0,
        nextReviewAt: row.nextReviewAt?.toISOString() ?? null,
      };
      result.get(row.deckId)?.words.push(item);
    }

    return [...result.values()];
  } catch (error) {
    console.error("Unable to load decks from the configured database.", error);
    throw new Error("Không thể tải dữ liệu từ cơ sở dữ liệu.", { cause: error });
  }
}

export async function getDeck(slug: string) {
  return (await getDecks()).find((deck) => deck.slug === slug) ?? null;
}

export async function getActivity(): Promise<ActivityItem[]> {
  const db = getDb();
  if (!db) return structuredClone(DEMO_ACTIVITY);

  try {
    const user = await getDemoUser(db);
    if (!user) return emptyRecentActivity();

    const dates = recentUtcDates();
    const startKey = dates[0].toISOString().slice(0, 10);
    const rows = await db
      .select()
      .from(dailyActivity)
      .where(
        and(
          eq(dailyActivity.userId, user.id),
          gte(dailyActivity.activityDate, startKey),
        ),
      )
      .orderBy(asc(dailyActivity.activityDate));

    const byDate = new Map(rows.map((row) => [row.activityDate, row]));
    const weekdays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    return dates.map((date) => {
      const key = date.toISOString().slice(0, 10);
      const row = byDate.get(key);
      return {
        day: weekdays[date.getUTCDay()],
        fullDate: `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
        reviewed: row?.reviewedCount ?? 0,
        learned: row?.learnedCount ?? 0,
        xp: row?.xpEarned ?? 0,
      };
    });
  } catch (error) {
    console.error("Unable to load activity from the configured database.", error);
    throw new Error("Không thể tải hoạt động từ cơ sở dữ liệu.", { cause: error });
  }
}
