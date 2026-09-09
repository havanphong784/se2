import { tagSentenceWords } from "./pos-tagger";
import type { SentenceItem } from "@/types/reading";

/**
 * Tách văn bản thành các đoạn (paragraphs) và câu (sentences) sử dụng Intl.Segmenter
 */
export function segmentText(rawContent: string): {
  paragraphs: Array<{
    id: string;
    index: number;
    sentences: SentenceItem[];
  }>;
  totalWords: number;
  totalSentences: number;
} {
  if (!rawContent || !rawContent.trim()) {
    return { paragraphs: [], totalWords: 0, totalSentences: 0 };
  }

  // Tách các đoạn văn (ngắt theo ít nhất 1 dòng trống hoặc newline kép, hoặc newline đơn nếu format thô)
  const rawParagraphs = rawContent
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  let sentenceGlobalIndex = 0;
  let wordCount = 0;

  // Sử dụng Intl.Segmenter chuẩn ES2022
  let segmenter: Intl.Segmenter | null = null;
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
  }

  const resultParagraphs = rawParagraphs.map((paraText, pIdx) => {
    let sentenceTexts: string[] = [];

    if (segmenter) {
      const segments = Array.from(segmenter.segment(paraText));
      sentenceTexts = segments
        .map((s) => s.segment.trim())
        .filter((s) => s.length > 0);
    } else {
      // Regex fallback cho sentence splitting
      sentenceTexts = paraText
        .split(/(?<=[.?!])\s+(?=[A-Z0-9"'])/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    if (sentenceTexts.length === 0) {
      sentenceTexts = [paraText];
    }

    const sentences: SentenceItem[] = sentenceTexts.map((sentText) => {
      const sId = `s-${pIdx}-${sentenceGlobalIndex++}`;
      const tokens = tagSentenceWords(sentText);
      const wordTokens = tokens.filter((t) => t.isWord);
      wordCount += wordTokens.length;

      return {
        id: sId,
        text: sentText,
        paragraphIndex: pIdx,
        tokens,
      };
    });

    return {
      id: `p-${pIdx}`,
      index: pIdx,
      sentences,
    };
  });

  return {
    paragraphs: resultParagraphs,
    totalWords: wordCount,
    totalSentences: sentenceGlobalIndex,
  };
}
