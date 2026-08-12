const DAY_MS = 24 * 60 * 60 * 1_000;
const AGAIN_DELAY_MS = 10 * 60 * 1_000;

export type Rating = "again" | "hard" | "good";

export type StudyProgress = {
  intervalDays: number;
};

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
  if (progress.status === "new" || !progress.nextReviewAt) return true;

  const nextReviewAt = Date.parse(progress.nextReviewAt);
  return !Number.isFinite(nextReviewAt) || nextReviewAt <= now.getTime();
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
