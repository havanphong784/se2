import { and, asc, eq, isNull, or, sql } from "drizzle-orm";

import {
  getDb,
  isDatabaseCoolingDown,
  markDatabaseAvailable,
  markDatabaseFailure,
} from "@/db";
import { dailyActivity, decks, wordProgress, words } from "@/db/schema";
import { getCurrentAuthUser } from "@/lib/auth";
import {
  DEMO_ACTIVITY,
  DEMO_DECKS,
  DEMO_STREAK,
  getDemoActivity,
  type DailyActivity as ActivityItem,
  type Streak,
  type VocabularyDeck,
  type VocabularyWord,
} from "@/lib/demo-data";
import {
  vnDateKey,
  vnDateKeyOffset,
  vnDayLabel,
  vnWeekDates,
  vnWeekdayLabel,
} from "@/lib/utils";

export type DataSource = "database" | "demo-unconfigured" | "demo-unavailable";

export type DataResult<T> = {
  data: T;
  source: DataSource;
  degraded: boolean;
};

export type LearningData = {
  decks: VocabularyDeck[];
  activity: ActivityItem[];
  streak: Streak;
};

function result<T>(data: T, source: DataSource): DataResult<T> {
  return { data, source, degraded: source !== "database" };
}

function fallbackDecks() {
  return structuredClone(DEMO_DECKS);
}

function fallbackActivity() {
  return getDemoActivity();
}

function fallbackStreak() {
  return structuredClone(DEMO_STREAK);
}

function fallbackLearningData(source: Exclude<DataSource, "database">): DataResult<LearningData> {
  return result(
    { decks: fallbackDecks(), activity: fallbackActivity(), streak: fallbackStreak() },
    source,
  );
}

function emptyRecentActivity(): ActivityItem[] {
  return vnWeekDates().map((date) => ({
    day: vnWeekdayLabel(date),
    fullDate: vnDayLabel(date),
    reviewed: 0,
    learned: 0,
    xp: 0,
    studySeconds: 0,
  }));
}

type ActivityRow = {
  activityDate: string;
  reviewedCount: number;
  learnedCount: number;
  xpEarned: number;
};

function isDayActive(row: ActivityRow | undefined): row is ActivityRow {
  return Boolean(row && (row.reviewedCount > 0 || row.learnedCount > 0 || row.xpEarned > 0));
}

/**
 * Tính streak từ danh sách `dailyActivity` rows.
 * - `current`: chuỗi liên tục tính ngược từ hôm nay. Nếu hôm nay chưa active
 *   nhưng hôm qua active thì vẫn giữ (status "at-risk", hôm nay vẫn còn thời gian học).
 *   Một ô gap 2 ngày liên tục (hôm nay + hôm qua đều không active) → 0.
 * - `best`: chuỗi dài nhất từng có trong toàn bộ rows.
 * - `status`: "active" (hôm nay đang active) / "at-risk" (hôm qua active, hôm nay chưa)
 *   / "broken" (đã đứt, phải học lại để reset).
 */
export function computeStreak(rows: ActivityRow[]): Streak {
  const todayKey = vnDateKey();
  const yesterdayKey = vnDateKeyOffset(-1);
  const byDate = new Map(rows.map((row) => [row.activityDate, row]));

  const isActive = (key: string) => isDayActive(byDate.get(key));

  // current streak: đếm ngược liên tục
  let current = 0;
  if (isActive(yesterdayKey) && !isActive(todayKey)) {
    // Hôm qua active, hôm nay chưa → streak còn giữ giá trị hôm qua, at-risk.
    let cursor = -1;
    while (isActive(vnDateKeyOffset(cursor))) {
      current += 1;
      cursor -= 1;
    }
  } else {
    let cursor = 0;
    while (isActive(vnDateKeyOffset(cursor))) {
      current += 1;
      cursor -= 1;
    }
  }

  // best streak: quét toàn bộ keys hiện có theo thứ tự ngày
  const sortedKeys = [...byDate.keys()].sort();
  let best = 0;
  let run = 0;
  let prevKey: string | null = null;
  for (const key of sortedKeys) {
    if (!isActive(key)) {
      run = 0;
      prevKey = key;
      continue;
    }
    if (prevKey && key === vnDateKeyOffset(1, new Date(prevKey))) {
      run += 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prevKey = key;
  }
  best = Math.max(best, current);

  const status: Streak["status"] = isActive(todayKey)
    ? "active"
    : current > 0
      ? "at-risk"
      : "broken";

  return { current, best, status };
}

async function loadDecks(
  db: NonNullable<ReturnType<typeof getDb>>,
  userId: string,
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
      and(eq(wordProgress.wordId, words.id), eq(wordProgress.userId, userId)),
    )
    .where(or(isNull(decks.ownerId), eq(decks.ownerId, userId)))
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

async function loadActivityData(
  db: NonNullable<ReturnType<typeof getDb>>,
  userId: string,
): Promise<{ activity: ActivityItem[]; streak: Streak }> {

  const rows = await db
    .select({
      activityDate: dailyActivity.activityDate,
      reviewedCount: dailyActivity.reviewedCount,
      learnedCount: dailyActivity.learnedCount,
      xpEarned: dailyActivity.xpEarned,
    })
    .from(dailyActivity)
    .where(eq(dailyActivity.userId, userId))
    .orderBy(asc(dailyActivity.activityDate));

  const streak = computeStreak(rows);

  const dates = vnWeekDates();
  const byDate = new Map(rows.map((row) => [row.activityDate, row]));
  const activity = dates.map((date) => {
    const key = vnDateKey(date);
    const row = byDate.get(key);
    return {
      day: vnWeekdayLabel(date),
      fullDate: vnDayLabel(date),
      reviewed: row?.reviewedCount ?? 0,
      learned: row?.learnedCount ?? 0,
      xp: row?.xpEarned ?? 0,
      studySeconds: 0,
    };
  });

  return { activity, streak };
}

async function loadSingleDeck(
  db: NonNullable<ReturnType<typeof getDb>>,
  slug: string,
  userId: string,
): Promise<VocabularyDeck | null> {
  const [deckRow] = await db
    .select({
      id: decks.id,
      ownerId: decks.ownerId,
      slug: decks.slug,
      title: decks.title,
      description: decks.description,
      level: decks.level,
    })
    .from(decks)
    .where(and(eq(decks.slug, slug), or(isNull(decks.ownerId), eq(decks.ownerId, userId))))
    .orderBy(sql`${decks.ownerId} is null`)
    .limit(1);

  if (!deckRow) return null;

  const rows = await db
    .select({
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
    .from(words)
    .leftJoin(
      wordProgress,
      and(eq(wordProgress.wordId, words.id), eq(wordProgress.userId, userId)),
    )
    .where(eq(words.deckId, deckRow.id))
    .orderBy(asc(words.sortOrder), asc(words.term));

  const fallbackEmoji = new Map(DEMO_DECKS.map((d) => [d.slug, d.emoji]));

  return {
    id: deckRow.id,
    slug: deckRow.slug,
    title: deckRow.title,
    description: deckRow.description,
    level: deckRow.level,
    emoji: fallbackEmoji.get(deckRow.slug) ?? "🌱",
    ownership: deckRow.ownerId ? "personal" : "system",
    words: rows.map((row) => ({
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
    })),
  };
}

export async function getLearningData(userId?: string): Promise<DataResult<LearningData>> {
  const db = getDb();
  if (!db) return fallbackLearningData("demo-unconfigured");
  if (isDatabaseCoolingDown()) return fallbackLearningData("demo-unavailable");

  try {
    const currentUser = userId ? null : await getCurrentAuthUser(db);
    const effectiveUserId = userId ?? currentUser?.id;
    if (!effectiveUserId) return fallbackLearningData("demo-unavailable");
    const [loadedDecks, { activity, streak }] = await Promise.all([
      loadDecks(db, effectiveUserId),
      loadActivityData(db, effectiveUserId),
    ]);
    markDatabaseAvailable();
    return result({ decks: loadedDecks, activity, streak }, "database");
  } catch (error) {
    markDatabaseFailure(error);
    throw error;
  }
}

export async function getDecksResult(userId?: string): Promise<DataResult<VocabularyDeck[]>> {
  const learning = await getLearningData(userId);
  return result(learning.data.decks, learning.source);
}

export async function getDeckResult(
  slug: string,
  userId?: string,
): Promise<DataResult<VocabularyDeck | null>> {
  const db = getDb();
  if (!db) {
    const demo = DEMO_DECKS.find((d) => d.slug === slug) ?? null;
    return result(demo, "demo-unconfigured");
  }
  if (isDatabaseCoolingDown()) {
    const demo = DEMO_DECKS.find((d) => d.slug === slug) ?? null;
    return result(demo, "demo-unavailable");
  }

  try {
    const currentUser = userId ? null : await getCurrentAuthUser(db);
    const effectiveUserId = userId ?? currentUser?.id;
    if (!effectiveUserId) {
      const demo = DEMO_DECKS.find((d) => d.slug === slug) ?? null;
      return result(demo, "demo-unavailable");
    }
    const deck = await loadSingleDeck(db, slug, effectiveUserId);
    markDatabaseAvailable();
    return result(deck, "database");
  } catch (error) {
    markDatabaseFailure(error);
    throw error;
  }
}

export async function getActivityResult(userId?: string): Promise<DataResult<ActivityItem[]>> {
  const learning = await getLearningData(userId);
  return result(learning.data.activity, learning.source);
}

export async function getDecks(userId: string) {
  return (await getDecksResult(userId)).data;
}

export async function getDeck(slug: string, userId: string) {
  return (await getDeckResult(slug, userId)).data;
}

export async function getActivity(userId: string) {
  return (await getActivityResult(userId)).data;
}
