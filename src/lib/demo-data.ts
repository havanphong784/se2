import { TOPIC_METADATA } from "@/lib/topic-metadata";
import { vnDayLabel, vnWeekDates, vnWeekdayLabel } from "@/lib/utils";

export type WordStatus = "new" | "learning" | "mastered";

export type VocabularyWord = {
  id: string;
  term: string;
  translation: string;
  phonetic: string;
  partOfSpeech: string[];
  exampleSentence: string;
  exampleTranslation: string;
  status: WordStatus;
  mastery: number;
  intervalDays: number;
  learnedAt: string | null;
  reviewStage: 0 | 1 | 2 | 3;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  reviewCompletedAt: string | null;
};

export type VocabularyDeck = {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: string;
  emoji: string;
  ownership?: "system" | "personal";
  words: VocabularyWord[];
};

export type DailyActivity = {
  day: string;
  fullDate: string;
  reviewed: number;
  learned: number;
  xp: number;
  studySeconds?: number;
};

export type Streak = {
  /** Chuỗi ngày liên tục học tính đến hiện tại. */
  current: number;
  /** Chuỗi dài nhất từng đạt. */
  best: number;
  /** Trạng thái chuỗi hiện tại. */
  status: "active" | "at-risk" | "broken";
};

const word = (
  deck: string,
  term: string,
  translation: string,
  phonetic: string,
  partOfSpeech: string,
  exampleSentence: string,
  exampleTranslation: string,
  status: WordStatus = "new",
  mastery = 0,
  intervalDays = 0,
): VocabularyWord => ({
  id: `${deck}-${term.replaceAll(" ", "-")}`,
  term,
  translation,
  phonetic,
  partOfSpeech: partOfSpeech ? [partOfSpeech] : [],
  exampleSentence,
  exampleTranslation,
  status,
  mastery,
  intervalDays,
  learnedAt: status === "new" ? null : new Date(Date.now() - 3 * 86400000).toISOString(),
  reviewStage: status === "mastered" ? 3 : 0,
  lastReviewedAt: status === "new" ? null : new Date(Date.now() - 86400000).toISOString(),
  nextReviewAt:
    status === "new" || status === "mastered"
      ? null
      : new Date(Date.now() + (intervalDays || 1) * 86400000).toISOString(),
  reviewCompletedAt:
    status === "mastered" ? new Date(Date.now() - 86400000).toISOString() : null,
});

export const DEMO_DECKS: VocabularyDeck[] = Object.entries(TOPIC_METADATA).map(
  ([key, meta], index) => {
    const slug = key.replaceAll("_", "-");
    return {
      id: `deck-${slug}`,
      slug,
      title: meta.title,
      description: meta.description,
      level: meta.level,
      emoji: meta.emoji,
      ownership: "system",
      words:
        index === 0
          ? [
              word(
                slug,
                "watercolour",
                "màu nước",
                "/ˈwɔː.təˌkʌl.ər/",
                "danh từ",
                "She painted a beautiful landscape using her new watercolour set.",
                "Cô ấy đã vẽ một bức tranh phong cảnh tuyệt đẹp bằng bộ màu nước mới của mình.",
                "mastered",
                100,
                12,
              ),
              word(
                slug,
                "thumbtack",
                "đinh ghim",
                "/ˈθʌm.tæk/",
                "danh từ",
                "I used a blue thumbtack to pin the poster on the wall.",
                "Tôi đã dùng một chiếc đinh ghim màu xanh để ghim bức áp phích lên tường.",
                "learning",
                65,
                3,
              ),
              word(
                slug,
                "textbook",
                "sách giáo khoa",
                "/ˈtekst.bʊk/",
                "danh từ",
                "Students are required to bring their science textbook to class every day.",
                "Học sinh được yêu cầu mang sách giáo khoa khoa học đến lớp mỗi ngày.",
              ),
            ]
          : [
              word(
                slug,
                "pack",
                "bó, gói",
                "/pæk/",
                "động từ",
                "They need to pack their suitcases before leaving for the airport.",
                "Họ cần phải đóng gói hành lý trước khi lên đường ra sân bay.",
              ),
            ],
    };
  },
);

const DEMO_METRICS = [
  { reviewed: 8, learned: 4, xp: 55, studySeconds: 420 },
  { reviewed: 12, learned: 6, xp: 85, studySeconds: 540 },
  { reviewed: 7, learned: 3, xp: 45, studySeconds: 300 },
  { reviewed: 15, learned: 8, xp: 110, studySeconds: 660 },
  { reviewed: 10, learned: 5, xp: 75, studySeconds: 480 },
  { reviewed: 18, learned: 9, xp: 130, studySeconds: 780 },
  { reviewed: 6, learned: 3, xp: 40, studySeconds: 360 },
];

export function getDemoActivity(): DailyActivity[] {
  const dates = vnWeekDates();
  return dates.map((date, index) => {
    const metrics = DEMO_METRICS[index % DEMO_METRICS.length];
    return {
      day: vnWeekdayLabel(date),
      fullDate: vnDayLabel(date),
      ...metrics,
    };
  });
}

export const DEMO_ACTIVITY: DailyActivity[] = getDemoActivity();

export const DEMO_STREAK: Streak = {
  current: 6,
  best: 7,
  status: "active",
};

export function deckProgress(deck: VocabularyDeck) {
  if (!deck.words || deck.words.length === 0) {
    return { mastered: 0, learning: 0, learned: 0, fresh: 0, percent: 100, learnedPercent: 100 };
  }
  const mastered = deck.words.filter(
    (item) => item.status === "mastered" || Boolean(item.reviewCompletedAt),
  ).length;
  const learning = deck.words.filter(
    (item) => item.status !== "mastered" && !item.reviewCompletedAt && Boolean(item.learnedAt),
  ).length;
  const learned = mastered + learning;
  const completed = mastered + learning * 0.5;

  return {
    mastered,
    learning,
    learned,
    fresh: deck.words.length - learned,
    percent: Math.round((completed / deck.words.length) * 100),
    learnedPercent: Math.round((learned / deck.words.length) * 100),
  };
}
