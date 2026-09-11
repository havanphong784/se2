import type { DetectedPhrase, SentenceItem } from "@/types/reading";

export type SentenceInput = SentenceItem | { text: string } | string;
export type PhraseInput = DetectedPhrase | { cleanPhrase?: string; phraseText?: string } | string;

/**
 * Helper trích xuất chuỗi nội dung văn bản từ một đối tượng câu hoặc chuỗi nguyên bản
 */
export function getSentenceText(item: SentenceInput | undefined | null): string {
  if (!item) return "";
  if (typeof item === "string") return item.trim();
  if (typeof item === "object" && "text" in item && typeof item.text === "string") {
    return item.text.trim();
  }
  return "";
}

/**
 * Helper trích xuất cụm từ từ đối tượng DetectedPhrase hoặc chuỗi
 */
export function getPhraseText(phrase: PhraseInput | undefined | null): string {
  if (!phrase) return "";
  if (typeof phrase === "string") return phrase.trim();
  if (typeof phrase === "object") {
    if (typeof phrase.phraseText === "string" && phrase.phraseText.trim()) {
      return phrase.phraseText.trim();
    }
    if (typeof phrase.cleanPhrase === "string" && phrase.cleanPhrase.trim()) {
      return phrase.cleanPhrase.trim();
    }
  }
  return "";
}

export interface SlidingWindowResult {
  xmlContext: string;
  beforeText: string;
  targetText: string;
  afterText: string;
  detectedPhrases: string[];
}

/**
 * Xây dựng Sliding Window Context với các XML Semantic Tags:
 * <context_before>, <target_sentence>, <context_after>, <client_hints>.
 * Hỗ trợ sliding window 1-2 câu trước (kể cả xuyên paragraph) và 1 câu sau.
 */
export function buildSlidingWindowContext(
  allSentences: SentenceInput[],
  currentIndex: number,
  detectedPhrases?: PhraseInput[]
): string {
  if (!Array.isArray(allSentences) || allSentences.length === 0) {
    return [
      "<context_before></context_before>",
      "<target_sentence></target_sentence>",
      "<context_after></context_after>",
      "<client_hints></client_hints>",
    ].join("\n");
  }

  const safeIndex = Math.max(0, Math.min(currentIndex, allSentences.length - 1));
  const targetItem = allSentences[safeIndex];
  const targetText = getSentenceText(targetItem);

  // Sliding window 1-2 câu trước (kể cả xuyên paragraph)
  const beforeStart = Math.max(0, safeIndex - 2);
  const beforeItems = allSentences.slice(beforeStart, safeIndex);
  const beforeText = beforeItems
    .map(getSentenceText)
    .filter(Boolean)
    .join(" ");

  // 1 câu sau (nếu có)
  const afterItem = safeIndex + 1 < allSentences.length ? allSentences[safeIndex + 1] : undefined;
  const afterText = afterItem ? getSentenceText(afterItem) : "";

  // Danh sách cụm từ mớm cho AI
  const phraseList = (detectedPhrases || [])
    .map(getPhraseText)
    .filter(Boolean);

  const beforeTag = beforeText
    ? `<context_before>\n${beforeText}\n</context_before>`
    : "<context_before></context_before>";

  const targetTag = targetText
    ? `<target_sentence>\n${targetText}\n</target_sentence>`
    : "<target_sentence></target_sentence>";

  const afterTag = afterText
    ? `<context_after>\n${afterText}\n</context_after>`
    : "<context_after></context_after>";

  const hintsTag = phraseList.length > 0
    ? `<client_hints>\nDetected phrases: ${phraseList.join(", ")}\n</client_hints>`
    : "<client_hints></client_hints>";

  return `${beforeTag}\n${targetTag}\n${afterTag}\n${hintsTag}`;
}
