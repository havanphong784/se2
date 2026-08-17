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
  DEMO_STREAK,
  getDemoActivity,
  type DailyActivity as ActivityItem,
  type Streak,
  type VocabularyDeck,
  type VocabularyWord,
} from "@/lib/demo-data";
import { getDemoUser } from "@/lib/server-data";
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

async function loadActivityData(
  db: NonNullable<ReturnType<typeof getDb>>,
  user: Awaited<ReturnType<typeof getDemoUser>>,
): Promise<{ activity: ActivityItem[]; streak: Streak }> {
  if (!user) return { activity: emptyRecentActivity(), streak: computeStreak([]) };

  // Lấy 30 ngày gần nhất để tính streak best + current chính xác hơn,
  // nhưng UI weekly chỉ hiển thị 7 ngày cuối.
  const streakStartKey = vnDateKeyOffset(-29);
  const rows = await db
    .select({
      activityDate: dailyActivity.activityDate,
      reviewedCount: dailyActivity.reviewedCount,
      learnedCount: dailyActivity.learnedCount,
      xpEarned: dailyActivity.xpEarned,
    })
    .from(dailyActivity)
    .where(and(eq(dailyActivity.userId, user.id), gte(dailyActivity.activityDate, streakStartKey)))
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

export async function getLearningData(): Promise<DataResult<LearningData>> {
  const db = getDb();
  if (!db) return fallbackLearningData("demo-unconfigured");
  if (isDatabaseCoolingDown()) return fallbackLearningData("demo-unavailable");

  try {
    const user = await getDemoUser(db);
    const [loadedDecks, { activity, streak }] = await Promise.all([
      loadDecks(db, user),
      loadActivityData(db, user),
    ]);
    markDatabaseAvailable();
    return result({ decks: loadedDecks, activity, streak }, "database");
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
