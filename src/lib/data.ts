import { and, asc, eq, gte, isNull, or } from "drizzle-orm";

import {
  getDb,
  isDatabaseCoolingDown,
  markDatabaseAvailable,
  markDatabaseFailure,
} from "@/db";
import { dailyActivity, decks, wordProgress, words } from "@/db/schema";
import {
  DEMO_ACTIVITY,
  DEMO_DECKS,
  type DailyActivity as ActivityItem,
  type VocabularyDeck,
  type VocabularyWord,
} from "@/lib/demo-data";
import { getDemoUser } from "@/lib/server-data";

export type DataSource = "database" | "demo-unconfigured" | "demo-unavailable";

export type DataResult<T> = {
  data: T;
  source: DataSource;
  degraded: boolean;
};

export type LearningData = {
  decks: VocabularyDeck[];
  activity: ActivityItem[];
};

function result<T>(data: T, source: DataSource): DataResult<T> {
  return { data, source, degraded: source !== "database" };
}

function fallbackDecks() {
  return structuredClone(DEMO_DECKS);
}

function fallbackActivity() {
  return structuredClone(DEMO_ACTIVITY);
}

function fallbackLearningData(source: Exclude<DataSource, "database">): DataResult<LearningData> {
  return result({ decks: fallbackDecks(), activity: fallbackActivity() }, source);
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
    studySeconds: 0,
  }));
}

async function loadDecks(
  db: NonNullable<ReturnType<typeof getDb>>,
  user: Awaited<ReturnType<typeof getDemoUser>>,
): Promise<VocabularyDeck[]> {
  const rows = await db
    .select({
      deckId: decks.id,
      deckOwnerId: decks.ownerId,
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
      learnedAt: wordProgress.learnedAt,
      reviewStage: wordProgress.reviewStage,
      lastReviewedAt: wordProgress.lastReviewedAt,
      nextReviewAt: wordProgress.nextReviewAt,
      reviewCompletedAt: wordProgress.reviewCompletedAt,
    })
    .from(decks)
    .innerJoin(words, eq(words.deckId, decks.id))
    .leftJoin(
      wordProgress,
      user
        ? and(eq(wordProgress.wordId, words.id), eq(wordProgress.userId, user.id))
        : eq(wordProgress.id, "00000000-0000-0000-0000-000000000000"),
    )
    .where(user ? or(isNull(decks.ownerId), eq(decks.ownerId, user.id)) : isNull(decks.ownerId))
    .orderBy(asc(decks.sortOrder), asc(decks.slug), asc(words.sortOrder), asc(words.term));

  const fallbackEmoji = new Map(DEMO_DECKS.map((deck) => [deck.slug, deck.emoji]));
  const loadedDecks = new Map<string, VocabularyDeck>();

  for (const row of rows) {
    if (!loadedDecks.has(row.deckId)) {
      loadedDecks.set(row.deckId, {
        id: row.deckId,
        slug: row.deckSlug,
        title: row.deckTitle,
        description: row.deckDescription,
        level: row.deckLevel,
        emoji: fallbackEmoji.get(row.deckSlug) ?? "🌱",
        ownership: row.deckOwnerId ? "personal" : "system",
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
      learnedAt: row.learnedAt?.toISOString() ?? null,
      reviewStage: (row.reviewStage as VocabularyWord["reviewStage"] | null) ?? 0,
      lastReviewedAt: row.lastReviewedAt?.toISOString() ?? null,
      nextReviewAt: row.nextReviewAt?.toISOString() ?? null,
      reviewCompletedAt: row.reviewCompletedAt?.toISOString() ?? null,
    };
    loadedDecks.get(row.deckId)?.words.push(item);
  }

  return [...loadedDecks.values()];
}

async function loadActivity(
  db: NonNullable<ReturnType<typeof getDb>>,
  user: Awaited<ReturnType<typeof getDemoUser>>,
): Promise<ActivityItem[]> {
  if (!user) return emptyRecentActivity();

  const dates = recentUtcDates();
  const startKey = dates[0].toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(dailyActivity)
    .where(and(eq(dailyActivity.userId, user.id), gte(dailyActivity.activityDate, startKey)))
    .orderBy(asc(dailyActivity.activityDate));

  const byDate = new Map(rows.map((row) => [row.activityDate, row]));
  const weekdays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  return dates.map((date) => {
    const row = byDate.get(date.toISOString().slice(0, 10));
    return {
      day: weekdays[date.getUTCDay()],
      fullDate: `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      reviewed: row?.reviewedCount ?? 0,
      learned: row?.learnedCount ?? 0,
      xp: row?.xpEarned ?? 0,
      studySeconds: row?.studySeconds ?? 0,
    };
  });
}

export async function getLearningData(): Promise<DataResult<LearningData>> {
  const db = getDb();
  if (!db) return fallbackLearningData("demo-unconfigured");
  if (isDatabaseCoolingDown()) return fallbackLearningData("demo-unavailable");

  try {
    const user = await getDemoUser(db);
    const [loadedDecks, activity] = await Promise.all([
      loadDecks(db, user),
      loadActivity(db, user),
    ]);
    markDatabaseAvailable();
    return result({ decks: loadedDecks, activity }, "database");
  } catch (error) {
    markDatabaseFailure(error);
    return fallbackLearningData("demo-unavailable");
  }
}

export async function getDecksResult(): Promise<DataResult<VocabularyDeck[]>> {
  const learning = await getLearningData();
  return result(learning.data.decks, learning.source);
}

export async function getDeckResult(slug: string): Promise<DataResult<VocabularyDeck | null>> {
  const decksResult = await getDecksResult();
  return result(decksResult.data.find((deck) => deck.slug === slug) ?? null, decksResult.source);
}

export async function getActivityResult(): Promise<DataResult<ActivityItem[]>> {
  const learning = await getLearningData();
  return result(learning.data.activity, learning.source);
}

export async function getDecks() {
  return (await getDecksResult()).data;
}

export async function getDeck(slug: string) {
  return (await getDeckResult(slug)).data;
}

export async function getActivity() {
  return (await getActivityResult()).data;
}
