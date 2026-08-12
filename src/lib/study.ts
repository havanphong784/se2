const DAY_MS = 24 * 60 * 60 * 1_000;
const AGAIN_DELAY_MS = 10 * 60 * 1_000;

export type Rating = "again" | "hard" | "good";

export type StudyProgress = {
  intervalDays: number;
};

export type WordStatus = "new" | "learning" | "mastered";

export const MAX_SESSION_CARDS = 20;
export const MAX_NEW_CARDS_PER_SESSION = 5;
export const MAX_CARD_PRESENTATIONS = 3;

export type ReviewCard = {
  status: WordStatus;
  nextReviewAt: string | null;
};

export function createStudyQueue<T extends ReviewCard>(
  cards: T[],
  now: Date,
  maxCards = MAX_SESSION_CARDS,
  maxNewCards = MAX_NEW_CARDS_PER_SESSION,
) {
  const dueCards = cards.filter((card) => isDueForReview(card, now));
  const reviews = dueCards
    .filter((card) => card.status !== "new")
    .sort(compareReviewPriority);
  const fresh = dueCards
    .filter((card) => card.status === "new")
    .sort(compareReviewPriority)
    .slice(0, Math.max(0, maxNewCards));

  return [...reviews, ...fresh].slice(0, Math.max(0, maxCards));
}

export function computeMastery(currentMastery: number, rating: Rating) {
  const mastery = Math.max(0, Math.min(100, currentMastery));

  if (rating === "again") {
    if (mastery >= 80) return mastery - 10;
    if (mastery >= 60) return mastery - 20;
    return Math.max(0, mastery - 30);
  }

  return Math.min(100, mastery + (rating === "hard" ? 6 : 16));
}

export function computeWordStatus(
  currentStatus: WordStatus,
  mastery: number,
): WordStatus {
  if (mastery >= 80) return "mastered";
  if (currentStatus === "mastered" && mastery >= 60) return "mastered";
  return mastery > 0 ? "learning" : "new";
}

export function computeNextReview(
  progress: StudyProgress,
  rating: Rating,
  now: Date,
) {
  const currentInterval = Math.max(0, progress.intervalDays);
  const intervalDays =
    rating === "again"
      ? 0
      : rating === "hard"
        ? Math.max(1, Math.ceil(currentInterval * 1.5))
        : currentInterval === 0
          ? 1
          : currentInterval === 1
            ? 3
            : currentInterval * 2;

  return {
    intervalDays,
    nextReviewAt: new Date(
      now.getTime() + (rating === "again" ? AGAIN_DELAY_MS : intervalDays * DAY_MS),
    ),
  };
}

export function isDueForReview(
  progress: { status: "new" | "learning" | "mastered"; nextReviewAt: string | null },
  now: Date,
) {
  if (progress.status === "new") return true;
  if (!progress.nextReviewAt) return progress.status === "learning";

  const nextReviewAt = Date.parse(progress.nextReviewAt);
  return Number.isFinite(nextReviewAt) && nextReviewAt <= now.getTime();
}

export function compareReviewPriority(
  left: { status: "new" | "learning" | "mastered"; nextReviewAt: string | null },
  right: { status: "new" | "learning" | "mastered"; nextReviewAt: string | null },
) {
  const priority = { learning: 0, new: 1, mastered: 2 };
  const statusDifference = priority[left.status] - priority[right.status];
  if (statusDifference !== 0) return statusDifference;

  const dueTime = (value: string | null) => {
    if (!value) return Number.NEGATIVE_INFINITY;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
  };

  return dueTime(left.nextReviewAt) - dueTime(right.nextReviewAt);
}

export function summarizeSession(ratings: Rating[], total: number) {
  const again = ratings.filter((rating) => rating === "again").length;
  const hard = ratings.filter((rating) => rating === "hard").length;
  const good = ratings.length - again - hard;
  const reviewed = ratings.length;

  return {
    reviewed,
    remaining: Math.max(0, total - reviewed),
    again,
    hard,
    good,
    accuracy: reviewed === 0 ? 0 : Math.round(((hard + good) / reviewed) * 100),
  };
}
