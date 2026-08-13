const DAY_MS = 24 * 60 * 60 * 1_000;

export type WordStatus = "new" | "learning" | "mastered";
export type StudyMode = "learn" | "review";
export type StudyPhase = "flashcard" | "multiple_choice" | "typing";
export type SessionSize = 10 | 20;
export type ReviewStage = 0 | 1 | 2 | 3;
export type StudySpeechSpeed = "slow" | "normal";

export type HighlightedTextPart = {
  text: string;
  highlighted: boolean;
};

export const SESSION_SIZES: SessionSize[] = [10, 20];

export type StudyWord = {
  id: string;
  term: string;
  translation: string;
  learnedAt: string | null;
  reviewStage: ReviewStage;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  reviewCompletedAt: string | null;
};

export function addDays(now: Date, days: number) {
  return new Date(now.getTime() + days * DAY_MS);
}

export function selectNewWords<T extends Pick<StudyWord, "learnedAt">>(
  words: T[],
  requestedSize: SessionSize,
) {
  return words.filter((word) => !word.learnedAt).slice(0, requestedSize);
}

export function isDueForReview(
  progress: Pick<StudyWord, "learnedAt" | "nextReviewAt" | "reviewCompletedAt">,
  now: Date,
) {
  if (!progress.learnedAt || progress.reviewCompletedAt || !progress.nextReviewAt) return false;
  const dueAt = Date.parse(progress.nextReviewAt);
  return Number.isFinite(dueAt) && dueAt <= now.getTime();
}

export function compareReviewPriority(
  left: Pick<StudyWord, "id" | "lastReviewedAt" | "nextReviewAt">,
  right: Pick<StudyWord, "id" | "lastReviewedAt" | "nextReviewAt">,
) {
  const time = (value: string | null, fallback: number) => {
    if (!value) return fallback;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
  };
  const dueDifference =
    time(left.nextReviewAt, Number.POSITIVE_INFINITY) -
    time(right.nextReviewAt, Number.POSITIVE_INFINITY);
  if (dueDifference !== 0) return dueDifference;
  const reviewDifference =
    time(left.lastReviewedAt, Number.NEGATIVE_INFINITY) -
    time(right.lastReviewedAt, Number.NEGATIVE_INFINITY);
  return reviewDifference || left.id.localeCompare(right.id);
}

export function selectDueWords<T extends StudyWord>(
  words: T[],
  requestedSize: SessionSize,
  now: Date,
) {
  return words
    .filter((word) => isDueForReview(word, now))
    .sort(compareReviewPriority)
    .slice(0, requestedSize);
}

export function moveFirstToEnd<T>(queue: T[]) {
  if (queue.length < 2) return [...queue];
  return [...queue.slice(1), queue[0]];
}

export function normalizeAnswer(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\s+/g, " ");
}

export function isTypingAnswerCorrect(expected: string, actual: string) {
  const answer = normalizeAnswer(actual);
  return answer.length > 0 && answer === normalizeAnswer(expected);
}

export function getStudySpeechSpeed(phase: StudyPhase): StudySpeechSpeed {
  return phase === "flashcard" ? "slow" : "normal";
}

export function highlightTermInExample(example: string, term: string): HighlightedTextPart[] {
  const normalizedTerm = term.trim();
  if (!normalizedTerm) return [{ text: example, highlighted: false }];

  const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`(${escapedTerm})`, "gi");
  return example
    .split(matcher)
    .filter(Boolean)
    .map((text) => ({
      text,
      highlighted: text.localeCompare(normalizedTerm, "en", { sensitivity: "accent" }) === 0,
    }));
}

export type StudyShortcutAction =
  | { type: "previous-flashcard" }
  | { type: "next-flashcard" }
  | { type: "choose-option"; optionIndex: number }
  | { type: "continue-feedback" }
  | { type: "speak" }
  | { type: "toggle-auto-speak" };

export function getStudyShortcutAction({
  key,
  phase,
  hasFeedback,
  flashcardIndex,
  optionCount,
  canSpeak,
}: {
  key: string;
  phase: StudyPhase;
  hasFeedback: boolean;
  flashcardIndex: number;
  optionCount: number;
  canSpeak: boolean;
}): StudyShortcutAction | null {
  const normalizedKey = key.toLocaleLowerCase("en");

  if (normalizedKey === "m" && canSpeak) return { type: "toggle-auto-speak" };
  if (
    normalizedKey === "p" &&
    canSpeak &&
    (phase !== "typing" || hasFeedback)
  ) {
    return { type: "speak" };
  }
  if (hasFeedback) {
    return key === "Enter" ? { type: "continue-feedback" } : null;
  }
  if (phase === "flashcard") {
    if (key === "ArrowLeft" && flashcardIndex > 0) {
      return { type: "previous-flashcard" };
    }
    return key === "ArrowRight" ? { type: "next-flashcard" } : null;
  }
  if (phase !== "multiple_choice") return null;

  const numberIndex = Number.parseInt(normalizedKey, 10) - 1;
  const letterIndex = normalizedKey.length === 1 ? normalizedKey.charCodeAt(0) - 97 : -1;
  const optionIndex = numberIndex >= 0 && numberIndex <= 3 ? numberIndex : letterIndex;
  return optionIndex >= 0 && optionIndex < Math.min(4, optionCount)
    ? { type: "choose-option", optionIndex }
    : null;
}

export function evaluateStudyAnswer({
  phase,
  wordId,
  term,
  translation,
  selectedWordId,
  answer,
}: {
  phase: StudyPhase;
  wordId: string;
  term: string;
  translation: string;
  selectedWordId?: string;
  answer?: string;
}) {
  return {
    isCorrect:
      phase === "flashcard"
        ? true
        : phase === "multiple_choice"
          ? selectedWordId === wordId
          : isTypingAnswerCorrect(term, answer ?? ""),
    expectedAnswer: phase === "typing" ? term : translation,
  };
}

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle<T>(items: T[], seed: string) {
  const result = [...items];
  let state = hashSeed(seed) || 1;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const target = state % (index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function createMultipleChoiceOptions<T extends Pick<StudyWord, "id" | "translation">>(
  target: T,
  sessionWords: T[],
  seed: string,
) {
  const seen = new Set([normalizeAnswer(target.translation)]);
  const distractors = seededShuffle(
    sessionWords.filter((word) => word.id !== target.id),
    `${seed}:distractors`,
  ).filter((word) => {
    const normalized = normalizeAnswer(word.translation);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  return seededShuffle([target, ...distractors.slice(0, 3)], `${seed}:options`);
}

export type ReviewSchedule = {
  reviewStage: ReviewStage;
  intervalDays: number;
  nextReviewAt: Date | null;
  reviewCompletedAt: Date | null;
  status: WordStatus;
};

export function scheduleLearnedWord(now: Date): ReviewSchedule {
  return {
    reviewStage: 0,
    intervalDays: 3,
    nextReviewAt: addDays(now, 3),
    reviewCompletedAt: null,
    status: "learning",
  };
}

export function scheduleIncorrectReview(now: Date): ReviewSchedule {
  return {
    reviewStage: 0,
    intervalDays: 1,
    nextReviewAt: addDays(now, 1),
    reviewCompletedAt: null,
    status: "learning",
  };
}

export function scheduleCorrectReview(
  currentStage: ReviewStage,
  hadIncorrectAttempt: boolean,
  now: Date,
): ReviewSchedule {
  if (hadIncorrectAttempt) return scheduleLearnedWord(now);
  if (currentStage === 0) {
    return {
      reviewStage: 1,
      intervalDays: 7,
      nextReviewAt: addDays(now, 7),
      reviewCompletedAt: null,
      status: "learning",
    };
  }
  if (currentStage === 1) {
    return {
      reviewStage: 2,
      intervalDays: 30,
      nextReviewAt: addDays(now, 30),
      reviewCompletedAt: null,
      status: "learning",
    };
  }
  return {
    reviewStage: 3,
    intervalDays: 0,
    nextReviewAt: null,
    reviewCompletedAt: new Date(now),
    status: "mastered",
  };
}

export function summarizeSession({
  selectedCount,
  completedCount,
  attemptCount,
  incorrectCount,
}: {
  selectedCount: number;
  completedCount: number;
  attemptCount: number;
  incorrectCount: number;
}) {
  return {
    selectedCount,
    completedCount,
    remainingCount: Math.max(0, selectedCount - completedCount),
    attemptCount,
    incorrectCount,
    accuracy:
      attemptCount === 0
        ? 0
        : Math.round(((attemptCount - incorrectCount) / attemptCount) * 100),
  };
}
