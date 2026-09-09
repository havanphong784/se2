import { tagSentenceWords } from "./pos-tagger";
import type { SentenceItem, ParagraphBlock, BlockType } from "@/types/reading";

/**
 * Khử hiện tượng từ bị đứt đoạn gạch nối ở cuối dòng trong file PDF / scan
 * Ví dụ: "arti-\nficial" -> "artificial"
 */
function dehyphenateText(text: string): string {
  return text.replace(/([a-zA-Z]{2,})-\n\s*([a-zA-Z]{2,})/g, "$1$2");
}

/**
 * Nhận diện loại khối văn bản (Heading, List, Quote, Paragraph)
 */
function detectBlockType(text: string): {
  type: BlockType;
  headingLevel?: 1 | 2 | 3;
  cleanedText: string;
} {
  const trimmed = text.trim();

  // 1. Markdown Heading (# H1, ## H2, ### H3)
  if (/^#{1,3}\s+/.test(trimmed)) {
    const match = trimmed.match(/^(#{1,3})\s+([\s\S]*)$/);
    const hashes = match ? match[1].length : 1;
    const content = match ? match[2].trim() : trimmed;
    return {
      type: "heading",
      headingLevel: hashes as 1 | 2 | 3,
      cleanedText: content,
    };
  }

  // 2. Tiêu đề dạng số hoặc chữ in hoa ngắn (vd: "1. Introduction", "CHAPTER I", "ABSTRACT")
  const isShort = trimmed.length < 80;
  const isAllUpper = isShort && /^[A-Z0-9\s:—–-]+$/.test(trimmed) && trimmed.length > 3;
  const isNumberedHeading =
    isShort &&
    /^(?:(?:Chapter|Section|Part)\s+[0-9IVXLCDM]+|[0-9]+\.[0-9]*\s+[A-Z])/i.test(trimmed);

  if (isAllUpper || isNumberedHeading) {
    return {
      type: "heading",
      headingLevel: 2,
      cleanedText: trimmed,
    };
  }

  // 3. Blockquote (bắt đầu bằng >)
  if (/^>\s+/.test(trimmed)) {
    return {
      type: "quote",
      cleanedText: trimmed.replace(/^>\s*/, "").trim(),
    };
  }

  // 4. List item (- item, * item, • item, 1. item)
  if (/^(?:[-*•]|\d+\.|\([a-z0-9]+\))\s+/i.test(trimmed)) {
    return {
      type: "list_item",
      cleanedText: trimmed,
    };
  }

  // 5. Paragraph mặc định
  return {
    type: "paragraph",
    cleanedText: trimmed,
  };
}

/**
 * Chuẩn hóa các dòng bẻ gãy từ PDF/OCR: ghép các dòng mềm thành câu hoàn chỉnh
 */
function normalizeRawParagraphs(rawContent: string): string[] {
  const dehyphenated = dehyphenateText(rawContent.replace(/\r\n/g, "\n"));

  // Tách theo các khối dòng trống kép
  const rawBlocks = dehyphenated
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const normalizedBlocks: string[] = [];

  for (const block of rawBlocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length <= 1) {
      normalizedBlocks.push(block);
      continue;
    }

    // Tách riêng các dòng bullet / list item khỏi đoạn văn thông thường
    let currentParagraphLines: string[] = [];

    for (const line of lines) {
      const isBullet = /^(?:[-*•]|\d+\.|\([a-z0-9]+\))\s+/i.test(line);
      if (isBullet) {
        if (currentParagraphLines.length > 0) {
          normalizedBlocks.push(currentParagraphLines.join(" "));
          currentParagraphLines = [];
        }
        normalizedBlocks.push(line);
      } else {
        currentParagraphLines.push(line);
      }
    }

    if (currentParagraphLines.length > 0) {
      normalizedBlocks.push(currentParagraphLines.join(" "));
    }
  }

  return normalizedBlocks;
}

/**
 * Tách văn bản thành các khối có ngữ nghĩa (ParagraphBlock) và các câu (SentenceItem)
 */
export function segmentText(rawContent: string): {
  paragraphs: ParagraphBlock[];
  totalWords: number;
  totalSentences: number;
} {
  if (!rawContent || !rawContent.trim()) {
    return { paragraphs: [], totalWords: 0, totalSentences: 0 };
  }

  const rawBlocks = normalizeRawParagraphs(rawContent);

  let sentenceGlobalIndex = 0;
  let wordCount = 0;

  // Khởi tạo Intl.Segmenter chuẩn ES2022
  let segmenter: Intl.Segmenter | null = null;
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
  }

  const resultBlocks: ParagraphBlock[] = rawBlocks.map((blockText, pIdx) => {
    const { type, headingLevel, cleanedText } = detectBlockType(blockText);

    let sentenceTexts: string[] = [];

    // Đối với tiêu đề hoặc trích dẫn ngắn, coi toàn bộ là một câu
    if (type === "heading") {
      sentenceTexts = [cleanedText];
    } else if (segmenter) {
      const segments = Array.from(segmenter.segment(cleanedText));
      sentenceTexts = segments
        .map((s) => s.segment.trim())
        .filter((s) => s.length > 0);
    } else {
      // Regex fallback
      sentenceTexts = cleanedText
        .split(/(?<=[.?!])\s+(?=[A-Z0-9"'])/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    if (sentenceTexts.length === 0) {
      sentenceTexts = [cleanedText];
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
      id: `block-${pIdx}`,
      index: pIdx,
      type,
      headingLevel,
      sentences,
      rawText: cleanedText,
    };
  });

  return {
    paragraphs: resultBlocks,
    totalWords: wordCount,
    totalSentences: sentenceGlobalIndex,
  };
}
