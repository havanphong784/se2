import { and, asc, eq, gte } from "drizzle-orm";

import { getDb } from "@/db";
import {
  dailyActivity,
  decks,
  users,
  wordProgress,
  words,
} from "@/db/schema";
import {
  DEMO_ACTIVITY,
  DEMO_DECKS,
  type DailyActivity as ActivityItem,
  type VocabularyDeck,
  type VocabularyWord,
} from "@/lib/demo-data";

const demoEmail = process.env.DEMO_USER_EMAIL ?? "demo@vocabloom.vn";

function fallbackDecks() {
  return structuredClone(DEMO_DECKS);
}

export async function getDecks(): Promise<VocabularyDeck[]> {
  const db = getDb();
  if (!db) return fallbackDecks();

  try {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, demoEmail))
      .limit(1);

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
      };
      result.get(row.deckId)?.words.push(item);
    }

    return result.size ? [...result.values()] : fallbackDecks();
  } catch (error) {
    console.warn("Database unavailable, using VocaBloom demo content.", error);
    return fallbackDecks();
  }
}

export async function getDeck(slug: string) {
  return (await getDecks()).find((deck) => deck.slug === slug) ?? null;
}

export async function getActivity(): Promise<ActivityItem[]> {
  const db = getDb();
  if (!db) return structuredClone(DEMO_ACTIVITY);

  try {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, demoEmail))
      .limit(1);
    if (!user) return structuredClone(DEMO_ACTIVITY);

    const start = new Date();
    start.setDate(start.getDate() - 6);
    const startKey = start.toISOString().slice(0, 10);
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

    if (!rows.length) return structuredClone(DEMO_ACTIVITY);
    const weekdays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    return rows.map((row) => {
      const date = new Date(`${row.activityDate}T00:00:00`);
      return {
        day: weekdays[date.getDay()],
        fullDate: `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`,
        reviewed: row.reviewedCount,
        learned: row.learnedCount,
        xp: row.xpEarned,
      };
    });
  } catch (error) {
    console.warn("Activity query failed, using demo activity.", error);
    return structuredClone(DEMO_ACTIVITY);
  }
}
