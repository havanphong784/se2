import { tagSentenceWords } from "./pos-tagger";
import type { SentenceItem, ParagraphBlock, BlockType } from "@/types/reading";

/**
 * Danh sách các từ viết tắt tiếng Anh phổ biến (tránh nhầm lẫn dấu chấm viết tắt là hết câu)
 */
const COMMON_ABBREVIATIONS = [
  "dr", "mr", "mrs", "ms", "prof", "sr", "jr",
  "e.g", "i.e", "etc", "vs", "fig", "figs", "al", "approx",
  "dept", "est", "vol", "no", "gen", "rep", "sen",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
  "u.s", "u.k", "e.u", "d.c"
];

const ABBR_PLACEHOLDER = "\uE000";

/**
 * Tạm thời thay thế dấu chấm trong từ viết tắt và số thập phân bằng ký tự đặc biệt
 */
function protectAbbreviations(text: string): string {
  let res = text;
  for (const abbr of COMMON_ABBREVIATIONS) {
    const reg = new RegExp(`\\b(${abbr})\\.(?!$)`, "gi");
    res = res.replace(reg, `$1${ABBR_PLACEHOLDER}`);
  }
  // Số thập phân (vd: 1.5, 3.14)
  res = res.replace(/(\d+)\.(\d+)/g, `$1${ABBR_PLACEHOLDER}$2`);
  return res;
}

/**
 * Khôi phục lại dấu chấm từ placeholder
 */
function unprotectAbbreviations(text: string): string {
  return text.replace(new RegExp(ABBR_PLACEHOLDER, "g"), ".");
}

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
 * Kiểm tra xem một ký tự có phải dấu kết thúc câu hay không
 */
function isTerminalPunctuation(char: string): boolean {
  return [".", "!", "?", ":", ";"].includes(char);
}

/**
 * Hàn gắn các khối văn bản bị ngắt dòng mềm vô cớ qua nhiều dòng trống hoặc qua trang
 */
function mergeBrokenBlocks(blocks: string[]): string[] {
  const merged: string[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const current = blocks[i].trim();
    if (!current) continue;

    if (merged.length === 0) {
      merged.push(current);
      continue;
    }

    const prev = merged[merged.length - 1];
    const prevTrimmed = prev.trim();
    const lastChar = prevTrimmed.slice(-1);
    const firstChar = current[0] || "";

    const isPrevHeading = /^#{1,3}\s+/.test(prevTrimmed);
    const isCurrentHeading = /^#{1,3}\s+/.test(current);
    const isCurrentBullet = /^(?:[-*•]|\d+\.|\([a-z0-9]+\))\s+/i.test(current);
    const isCurrentQuote = /^>\s+/.test(current);

    // Dòng trước chưa có dấu kết thúc câu và không phải là Heading
    const prevDangling = !isTerminalPunctuation(lastChar) && !isPrevHeading;

    // Dòng sau bắt đầu bằng chữ thường hoặc dấu tiếp diễn (, ; ) ] })
    const currentStartsLower = /^[a-z,;)\\]}]/.test(firstChar);

    // Dòng trước kết thúc bằng dấu phẩy, gạch nối hoặc từ nối tiếp
    const prevEndsWithConnecting =
      /[,(-—–]\s*$/.test(prevTrimmed) ||
      /\b(?:and|or|but|because|in|on|at|to|for|of|with|by|that|which|as|from|than|including)\s*$/i.test(
        prevTrimmed
      );

    // Nếu không phải là heading / bullet / quote mới, và thỏa mãn tính chất câu bị ngắt gãy
    if (
      !isCurrentHeading &&
      !isCurrentBullet &&
      !isCurrentQuote &&
      prevDangling &&
      (currentStartsLower || prevEndsWithConnecting)
    ) {
      merged[merged.length - 1] = prevTrimmed + " " + current;
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Chuẩn hóa các dòng bẻ gãy từ PDF/OCR:
 * - Khử comment <!-- Page ... -->
 * - Ghép các dòng mềm (soft wrap) thành đoạn văn hoàn chỉnh
 * - Bảo tồn các gạch đầu dòng nhiều dòng (multi-line bullet points)
 */
function normalizeRawParagraphs(rawContent: string): string[] {
  // 1. Loại bỏ các thẻ HTML comment (ví dụ: <!-- Page 11 -->)
  const cleanedComments = rawContent.replace(/<!--[\s\S]*?-->/g, "");
  const dehyphenated = dehyphenateText(cleanedComments.replace(/\r\n/g, "\n"));

  // 2. Tách theo các khối dòng trống kép
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

    let currentParagraphLines: string[] = [];
    let currentBulletLines: string[] = [];

    for (const line of lines) {
      const isBullet = /^(?:[-*•]|\d+\.|\([a-z0-9]+\))\s+/i.test(line);

      if (isBullet) {
        if (currentParagraphLines.length > 0) {
          normalizedBlocks.push(currentParagraphLines.join(" "));
          currentParagraphLines = [];
        }
        if (currentBulletLines.length > 0) {
          normalizedBlocks.push(currentBulletLines.join(" "));
          currentBulletLines = [];
        }
        currentBulletLines.push(line);
      } else if (currentBulletLines.length > 0) {
        // Dòng tiếp nối của gạch đầu dòng trước đó (Multi-line Bullet Continuation)
        const prevBullet = currentBulletLines[currentBulletLines.length - 1];
        const prevLastChar = prevBullet.trim().slice(-1);
        const isHeading = /^#{1,3}\s+/.test(line);

        if (
          !isHeading &&
          (!isTerminalPunctuation(prevLastChar) || /^[a-z,;)]/.test(line))
        ) {
          currentBulletLines.push(line);
        } else {
          normalizedBlocks.push(currentBulletLines.join(" "));
          currentBulletLines = [];
          currentParagraphLines.push(line);
        }
      } else {
        currentParagraphLines.push(line);
      }
    }

    if (currentBulletLines.length > 0) {
      normalizedBlocks.push(currentBulletLines.join(" "));
    }
    if (currentParagraphLines.length > 0) {
      normalizedBlocks.push(currentParagraphLines.join(" "));
    }
  }

  // 3. Hàn gắn các khối câu bị ngắt ngẫu nhiên giữa chừng
  return mergeBrokenBlocks(normalizedBlocks);
}

/**
 * Tách văn bản thành các khối có ngữ nghĩa (ParagraphBlock) và các câu (SentenceItem)
 * Tối ưu hóa chống cắt câu ngang xương khi xuống hàng hoặc gặp từ viết tắt
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

    // Làm phẳng tất cả các khoảng trắng và ngắt dòng nội bộ thành 1 dòng liên tục
    // Tránh việc Intl.Segmenter tự động ngắt câu khi gặp ký tự \n
    const singleLineText = cleanedText
      .replace(/\s*\n\s*/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    let sentenceTexts: string[] = [];

    // Đối với tiêu đề, coi toàn bộ là một câu
    if (type === "heading") {
      sentenceTexts = [singleLineText];
    } else {
      // Bảo vệ từ viết tắt (Dr., Mr., e.g., i.e., v.v.) và số thập phân
      const protectedText = protectAbbreviations(singleLineText);

      let rawSegments: string[] = [];
      if (segmenter) {
        const segments = Array.from(segmenter.segment(protectedText));
        rawSegments = segments
          .map((s) => unprotectAbbreviations(s.segment.trim()))
          .filter((s) => s.length > 0);
      } else {
        // Regex fallback
        rawSegments = protectedText
          .split(/(?<=[.?!])\s+(?=[A-Z0-9"'])/)
          .map((s) => unprotectAbbreviations(s.trim()))
          .filter((s) => s.length > 0);
      }

      // Hàn gắn các câu bị cắt vụn (nếu câu trước chưa có dấu kết thúc và câu sau bắt đầu bằng chữ thường)
      const stitched: string[] = [];
      for (const current of rawSegments) {
        if (!current) continue;
        if (stitched.length === 0) {
          stitched.push(current);
          continue;
        }

        const prev = stitched[stitched.length - 1];
        const prevLastChar = prev.slice(-1);
        const isPrevTerminal = [".", "!", "?", ":"].includes(prevLastChar);
        const currentStartsLower = /^[a-z,;)\]}]/.test(current);

        if (!isPrevTerminal && currentStartsLower) {
          stitched[stitched.length - 1] = prev + " " + current;
        } else {
          stitched.push(current);
        }
      }

      sentenceTexts = stitched.length > 0 ? stitched : [singleLineText];
    }

    if (sentenceTexts.length === 0) {
      sentenceTexts = [singleLineText];
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
      rawText: singleLineText,
    };
  });

  return {
    paragraphs: resultBlocks,
    totalWords: wordCount,
    totalSentences: sentenceGlobalIndex,
  };
}
