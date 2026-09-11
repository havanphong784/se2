import { getDocumentProxy } from "unpdf";
import { createWorker } from "tesseract.js";
import * as mammoth from "mammoth";
import type {
  StructuredDocumentMeta,
  DocumentChunk,
  TableOfContentItem,
} from "@/types/reading";

const PAGES_PER_CHUNK = 10;
const WORDS_PER_PAGE_ESTIMATE = 350;

/**
 * Kiểu dữ liệu chứa thông tin hình học và typography đầy đủ của một TextItem trong PDF.
 * Tọa độ y chuẩn hóa theo hệ trục top-down (0 nằm ở đỉnh trang, tăng dần xuống đáy).
 */
export interface PdfGeometryItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily?: string;
  hasEOL?: boolean;
}

export interface HeaderFooterFilterOptions {
  topMarginRatio?: number;
  bottomMarginRatio?: number;
  minMarginPt?: number;
}

export interface AssembledPageResult {
  pageText: string;
  headings: Array<{ title: string; level: 1 | 2 | 3 }>;
}

/**
 * Trích xuất TextItem kèm thông số hình học [x, y, width, height] và fontSize
 * từ danh sách items trả về bởi getTextContent() của PDF.js.
 */
export function extractGeometryItemsFromPage(
  items: Array<{
    str?: string;
    transform?: number[];
    width?: number;
    height?: number;
    fontName?: string;
    hasEOL?: boolean;
  }>,
  pageHeight: number
): PdfGeometryItem[] {
  const result: PdfGeometryItem[] = [];

  for (const item of items) {
    if (!item || typeof item.str !== "string") continue;
    if (item.str.trim().length === 0) continue;

    const transform = Array.isArray(item.transform)
      ? item.transform
      : [12, 0, 0, 12, 0, 0];
    const [a, b, c, d, e, f] = transform;

    const scaleX = Math.hypot(a, b);
    const scaleY = Math.hypot(c, d);
    const fontSize =
      scaleY > 0
        ? scaleY
        : scaleX > 0
          ? scaleX
          : typeof item.height === "number" && item.height > 0
            ? item.height
            : 12;

    const height =
      typeof item.height === "number" && item.height > 0
        ? item.height
        : fontSize;
    const width =
      typeof item.width === "number" && item.width > 0
        ? item.width
        : Math.max(1, item.str.length * (fontSize * 0.5));

    const x = e;
    // Tọa độ PDF có gốc (0,0) ở góc dưới trái (baseline y = f).
    // Chuyển đổi sang hệ trục top-down trực quan cho thứ tự đọc:
    const y = Math.max(0, pageHeight - f - height);

    result.push({
      str: item.str,
      x,
      y,
      width,
      height,
      fontSize,
      fontFamily: item.fontName,
      hasEOL: Boolean(item.hasEOL),
    });
  }

  return result;
}

/**
 * Lọc bỏ header, footer, số trang lặp lại ở mép trên / mép dưới của trang.
 */
export function filterHeadersAndFooters(
  pagesItems: PdfGeometryItem[][],
  pageDimensions: number | Array<{ width: number; height: number }>,
  options?: HeaderFooterFilterOptions
): PdfGeometryItem[][] {
  const topRatio = options?.topMarginRatio ?? 0.08;
  const bottomRatio = options?.bottomMarginRatio ?? 0.92;
  const minMarginPt = options?.minMarginPt ?? 45;
  const numPages = pagesItems.length;

  const getHeight = (pIdx: number): number => {
    if (typeof pageDimensions === "number") return pageDimensions;
    return pageDimensions[pIdx]?.height ?? 800;
  };

  const isPageNumberPattern = (text: string): boolean => {
    const trimmed = text.trim();
    if (!trimmed) return false;
    // vd: "1", "12", "- 1 -", "— 2 —", "Page 1", "Page 1 of 10", "1 / 10", "Trang 3"
    if (/^(?:page|trang)?\s*[-—–]?\s*\d+\s*(?:[-—–]|\/|of\s*\d+)?$/i.test(trimmed)) {
      return true;
    }
    // Số La Mã ở góc trang
    if (/^[ivxlcdmIVXLCDM]{1,6}$/.test(trimmed)) {
      return true;
    }
    return false;
  };

  const normalizeHeaderText = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/\d+/g, "")
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  // Đếm tần suất xuất hiện của chuỗi text ở mép trên/dưới qua các trang
  const headerTextsCount = new Map<string, number>();
  const footerTextsCount = new Map<string, number>();

  if (numPages >= 2) {
    for (let pIdx = 0; pIdx < numPages; pIdx++) {
      const pageHeight = getHeight(pIdx);
      const topThreshold = Math.max(minMarginPt, pageHeight * topRatio);
      const bottomThreshold = Math.min(pageHeight - minMarginPt, pageHeight * bottomRatio);

      const seenHeadersOnPage = new Set<string>();
      const seenFootersOnPage = new Set<string>();

      for (const item of pagesItems[pIdx]) {
        const norm = normalizeHeaderText(item.str);
        if (norm.length < 3) continue;

        if (item.y <= topThreshold) {
          seenHeadersOnPage.add(norm);
        } else if (item.y >= bottomThreshold) {
          seenFootersOnPage.add(norm);
        }
      }

      for (const h of seenHeadersOnPage) {
        headerTextsCount.set(h, (headerTextsCount.get(h) || 0) + 1);
      }
      for (const f of seenFootersOnPage) {
        footerTextsCount.set(f, (footerTextsCount.get(f) || 0) + 1);
      }
    }
  }

  return pagesItems.map((items, pIdx) => {
    const pageHeight = getHeight(pIdx);
    const topThreshold = Math.max(minMarginPt, pageHeight * topRatio);
    const bottomThreshold = Math.min(pageHeight - minMarginPt, pageHeight * bottomRatio);

    return items.filter((item) => {
      const trimmed = item.str.trim();
      if (!trimmed) return false;

      const isHeaderZone = item.y <= topThreshold;
      const isFooterZone = item.y >= bottomThreshold;

      if (!isHeaderZone && !isFooterZone) return true;

      // Lọc số trang ở mép trên hoặc mép dưới
      if (isPageNumberPattern(trimmed)) {
        return false;
      }

      // Lọc running header / footer lặp lại trên 2 trang trở lên
      if (numPages >= 2) {
        const norm = normalizeHeaderText(trimmed);
        if (norm.length >= 3) {
          if (isHeaderZone && (headerTextsCount.get(norm) || 0) >= 2) {
            return false;
          }
          if (isFooterZone && (footerTextsCount.get(norm) || 0) >= 2) {
            return false;
          }
        }
      }

      // Tài liệu 1 trang: lọc thông tin bản quyền hoặc URL ở mép đáy
      if (numPages === 1 && isFooterZone) {
        if (/^(?:copyright|all rights reserved|\u00A9|www\.|\d{4}\s*-\s*\d{4})/i.test(trimmed)) {
          return false;
        }
      }

      return true;
    });
  });
}

/**
 * Tìm khoảng trống rãnh cột (gutter) tốt nhất giữa các cột văn bản
 */
function findBestGutter(
  bandItems: PdfGeometryItem[],
  bandMinX: number,
  bandMaxX: number
): { start: number; end: number; width: number } | null {
  const bandWidth = bandMaxX - bandMinX;
  if (bandWidth < 100) return null;

  const MIN_GUTTER_WIDTH = 12; // pt
  const searchStart = bandMinX + bandWidth * 0.15;
  const searchEnd = bandMaxX - bandWidth * 0.15;

  const intervals = bandItems
    .map((i) => ({ start: i.x, end: i.x + i.width }))
    .sort((a, b) => a.start - b.start);

  const merged: Array<{ start: number; end: number }> = [];
  for (const interval of intervals) {
    if (merged.length === 0) {
      merged.push({ ...interval });
    } else {
      const last = merged[merged.length - 1];
      if (interval.start <= last.end + 2) {
        last.end = Math.max(last.end, interval.end);
      } else {
        merged.push({ ...interval });
      }
    }
  }

  const validGutters: Array<{ start: number; end: number; width: number }> = [];
  for (let i = 0; i < merged.length - 1; i++) {
    const gStart = merged[i].end;
    const gEnd = merged[i + 1].start;
    const gWidth = gEnd - gStart;

    if (gWidth >= MIN_GUTTER_WIDTH && gEnd >= searchStart && gStart <= searchEnd) {
      validGutters.push({ start: gStart, end: gEnd, width: gWidth });
    }
  }

  if (validGutters.length > 0) {
    const center = (bandMinX + bandMaxX) / 2;
    validGutters.sort((a, b) => {
      const distA = Math.abs((a.start + a.end) / 2 - center);
      const distB = Math.abs((b.start + b.end) / 2 - center);
      return distA - distB;
    });
    return validGutters[0];
  }

  // Fallback: Quét histogram tìm khoảng trống rộng nhất trong vùng tìm kiếm
  let bestGutter: { start: number; end: number; width: number } | null = null;
  let maxSpan = 0;
  let currentEmptyStart: number | null = null;

  for (let x = searchStart; x <= searchEnd; x += 2) {
    const crossingCount = bandItems.filter(
      (i) => i.x <= x && i.x + i.width >= x
    ).length;

    if (crossingCount === 0) {
      if (currentEmptyStart === null) {
        currentEmptyStart = x;
      }
    } else {
      if (currentEmptyStart !== null) {
        const span = x - currentEmptyStart;
        if (span >= MIN_GUTTER_WIDTH && span > maxSpan) {
          maxSpan = span;
          bestGutter = {
            start: currentEmptyStart,
            end: x,
            width: span,
          };
        }
        currentEmptyStart = null;
      }
    }
  }

  if (currentEmptyStart !== null) {
    const span = searchEnd - currentEmptyStart;
    if (span >= MIN_GUTTER_WIDTH && span > maxSpan) {
      bestGutter = {
        start: currentEmptyStart,
        end: searchEnd,
        width: span,
      };
    }
  }

  return bestGutter;
}

/**
 * Sắp xếp các phần tử trong một khối cột đơn theo thứ tự đọc (từ trên xuống dưới, từ trái sang phải trên cùng 1 dòng)
 */
function sortSingleColumn(blockItems: PdfGeometryItem[]): PdfGeometryItem[] {
  if (blockItems.length <= 1) return blockItems;

  const sortedByY = [...blockItems].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: PdfGeometryItem[][] = [];

  for (const item of sortedByY) {
    if (lines.length === 0) {
      lines.push([item]);
      continue;
    }

    const currentLine = lines[lines.length - 1];
    const lineY = currentLine[0].y;
    const lineHeight = currentLine[0].height || currentLine[0].fontSize;
    const tolerance = Math.max(3, Math.min(lineHeight, item.height || item.fontSize) * 0.5);

    if (Math.abs(item.y - lineY) <= tolerance) {
      currentLine.push(item);
    } else {
      lines.push([item]);
    }
  }

  for (const line of lines) {
    line.sort((a, b) => a.x - b.x);
  }

  return lines.flat();
}

/**
 * Phân tích và chia cột đệ quy theo giải thuật XY-Cut
 */
function sortBand(bandItems: PdfGeometryItem[]): PdfGeometryItem[] {
  if (bandItems.length <= 1) return bandItems;

  const bandMinX = Math.min(...bandItems.map((i) => i.x));
  const bandMaxX = Math.max(...bandItems.map((i) => i.x + i.width));
  const gutter = findBestGutter(bandItems, bandMinX, bandMaxX);

  if (gutter) {
    const gutterMid = (gutter.start + gutter.end) / 2;
    const col1 = bandItems.filter((i) => i.x + i.width / 2 < gutterMid);
    const col2 = bandItems.filter((i) => i.x + i.width / 2 >= gutterMid);

    if (col1.length > 0 && col2.length > 0) {
      return [...sortBand(col1), ...sortBand(col2)];
    }
  }

  return sortSingleColumn(bandItems);
}

/**
 * Multi-column Sorting (XY-Cut / Column Segmentation):
 * Tách các cột văn bản dựa trên khoảng cách x giữa các cụm text,
 * đảm bảo đọc hết toàn bộ cột 1 rồi mới sang cột 2.
 * Đồng thời bảo tồn các khối tiêu đề / tóm tắt full-width trên đầu hoặc giữa trang.
 */
export function sortItemsIntoReadingOrder(
  items: PdfGeometryItem[],
  pageWidth?: number
): PdfGeometryItem[] {
  if (items.length <= 1) return [...items];

  const minX = Math.min(...items.map((i) => i.x));
  const maxX = Math.max(...items.map((i) => i.x + i.width));
  const contentWidth = maxX - minX;
  const effectivePageWidth = pageWidth || maxX + minX;

  // Xác định các khối full-width (tiêu đề bài viết, divider, tiêu đề phần lớn)
  const isFullWidthItem = (item: PdfGeometryItem): boolean => {
    return (
      item.width >= contentWidth * 0.65 ||
      item.width >= effectivePageWidth * 0.55 ||
      (item.x <= minX + contentWidth * 0.1 && item.x + item.width >= maxX - contentWidth * 0.1)
    );
  };

  const fullWidthItems = items.filter(isFullWidthItem);

  if (fullWidthItems.length > 0) {
    const sortedFullWidth = [...fullWidthItems].sort((a, b) => a.y - b.y);
    const result: PdfGeometryItem[] = [];
    let currentY = 0;

    for (const fwItem of sortedFullWidth) {
      const topY = fwItem.y;
      const bottomY = fwItem.y + fwItem.height;

      // Các item nằm phía trên fwItem và sau currentY
      const bandItems = items.filter(
        (i) => !isFullWidthItem(i) && i.y + i.height <= topY && i.y >= currentY
      );

      if (bandItems.length > 0) {
        result.push(...sortBand(bandItems));
      }

      result.push(fwItem);
      currentY = bottomY;
    }

    // Các item còn lại phía dưới khối full-width cuối cùng
    const remainingItems = items.filter((i) => !isFullWidthItem(i) && i.y >= currentY);
    if (remainingItems.length > 0) {
      result.push(...sortBand(remainingItems));
    }

    return result;
  }

  return sortBand(items);
}

/**
 * Khử đứt đoạn từ (de-hyphenation) khi từ bị gãy dòng bằng dấu gạch nối cuối dòng.
 * Ví dụ: "techno-\nlogy" -> "technology", "inter\u00ADnational" -> "international".
 */
export function dehyphenateText(text: string): string {
  if (!text) return "";

  // 1. Khử soft-hyphens (\u00AD)
  let cleaned = text.replace(/\u00AD/g, "");

  // 2. Nối các từ bị gãy dòng có dấu gạch nối ở cuối dòng
  cleaned = cleaned.replace(
    /([a-zA-Z]{2,})[-–—]\s*[\r\n]+\s*([a-zA-Z]{2,})/g,
    "$1$2"
  );

  return cleaned;
}

/**
 * Nối 2 dòng văn bản liên tiếp trong cùng đoạn văn, tự động khử gạch nối nếu dòng trước kết thúc bằng word-
 */
function joinLinesWithDehyphenation(prevText: string, nextText: string): string {
  const trimmedPrev = prevText.trimEnd();
  const trimmedNext = nextText.trimStart();

  const match = trimmedPrev.match(/([a-zA-Z]{2,})[-–—]$/);
  if (match && /^[a-zA-Z]{2,}/.test(trimmedNext)) {
    return trimmedPrev.slice(0, -1) + trimmedNext;
  }

  return `${trimmedPrev} ${trimmedNext}`;
}

/**
 * Tính cỡ chữ phổ biến nhất trong tài liệu (dominant / body font size)
 * sử dụng phân phối trọng số theo số lượng ký tự (character count).
 */
export function computeDominantFontSize(items: PdfGeometryItem[]): number {
  const sizeWeights = new Map<number, number>();

  for (const item of items) {
    const len = item.str.trim().length;
    if (len === 0) continue;

    // Làm tròn đến 0.5pt để gộp các sai số làm tròn font matrix (ví dụ 11.98 -> 12)
    const rounded = Math.round(item.fontSize * 2) / 2;
    sizeWeights.set(rounded, (sizeWeights.get(rounded) || 0) + len);
  }

  let dominantSize = 12;
  let maxWeight = 0;

  for (const [size, weight] of sizeWeights.entries()) {
    if (weight > maxWeight) {
      maxWeight = weight;
      dominantSize = size;
    }
  }

  return dominantSize;
}

/**
 * Phân loại Heading Level 1, 2, 3 dựa trên tỷ lệ font chữ so với cỡ chữ cơ bản (body font size)
 * kết hợp nhận diện cấu trúc tiêu đề (Chapter, Numbered section, All-Caps).
 */
export function classifyTypography(
  fontSize: number,
  dominantFontSize: number,
  text?: string
): { isHeading: boolean; headingLevel?: 1 | 2 | 3 } {
  if (dominantFontSize <= 0) dominantFontSize = 12;

  const ratio = fontSize / dominantFontSize;
  const trimmed = text?.trim() || "";

  if (!trimmed) {
    return { isHeading: false };
  }

  const isShort = trimmed.length <= 120;
  // Câu kết thúc bằng dấu chấm (không phải số thứ tự như "1.") thì không phải tiêu đề
  const endsWithTerminal =
    /[.!?]$/.test(trimmed) && !/^\d+(?:\.\d+)*\.$/.test(trimmed);

  if (!isShort || endsWithTerminal) {
    return { isHeading: false };
  }

  const isChapter = /^(?:chapter|part|unit)\s+[\dIVXLCDM]+/i.test(trimmed);
  const isNumberedH1 = /^\d+\.\s+[A-Z]/.test(trimmed);
  const isNumberedH2 = /^\d+\.\d+\s+[A-Z]/.test(trimmed);
  const isNumberedH3 = /^\d+\.\d+\.\d+\s+[A-Z]/.test(trimmed);
  const isAllUpper =
    trimmed.length >= 3 &&
    trimmed.length <= 60 &&
    /^[A-Z0-9\s:—–-]+$/.test(trimmed) &&
    !/^(page|\d+$)/i.test(trimmed);

  // Level 1: Chữ to vượt trội (>= 1.4x) hoặc từ khóa Chapter / Part
  if (ratio >= 1.4 || (ratio >= 1.25 && (isChapter || isNumberedH1)) || isChapter) {
    return { isHeading: true, headingLevel: 1 };
  }

  // Level 2: Chữ to vừa phải (1.18x - 1.4x) hoặc mục số cấp 1 / 2 hoặc in hoa ngắn
  if (
    (ratio >= 1.18 && ratio < 1.4) ||
    (ratio >= 1.1 && (isNumberedH2 || isAllUpper)) ||
    isNumberedH1
  ) {
    return { isHeading: true, headingLevel: 2 };
  }

  // Level 3: Chữ nhỉnh hơn body một chút (1.06x - 1.18x) hoặc mục số cấp 2 / 3
  if (
    (ratio >= 1.06 && ratio < 1.18) ||
    isNumberedH2 ||
    isNumberedH3
  ) {
    return { isHeading: true, headingLevel: 3 };
  }

  return { isHeading: false };
}

/**
 * Nối các item trên cùng một dòng thành chuỗi text, tự động xử lý khoảng cách giữa các từ
 */
function joinLineItems(items: PdfGeometryItem[]): string {
  if (items.length === 0) return "";
  let text = items[0].str;

  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const curr = items[i];
    const gap = curr.x - (prev.x + prev.width);

    const hasSpace = /\s$/.test(prev.str) || /^\s/.test(curr.str);
    if (!hasSpace && gap >= Math.min(prev.fontSize, curr.fontSize) * 0.18) {
      text += " " + curr.str;
    } else {
      text += curr.str;
    }
  }

  return text.replace(/\s+/g, " ").trim();
}

/**
 * Tổng hợp các items đã sắp xếp đúng thứ tự đọc thành các khối văn bản (Paragraphs & Headings),
 * chuẩn bị cho phân chia chunk và hiển thị trong reader.
 */
export function assemblePageText(
  sortedItems: PdfGeometryItem[],
  dominantFontSize: number
): AssembledPageResult {
  if (sortedItems.length === 0) {
    return { pageText: "", headings: [] };
  }

  // 1. Gom các item có cùng tọa độ Y thành từng dòng hiển thị
  const lines: Array<{
    items: PdfGeometryItem[];
    y: number;
    height: number;
    fontSize: number;
    text: string;
    isHeading: boolean;
    headingLevel?: 1 | 2 | 3;
  }> = [];

  let currentLineItems: PdfGeometryItem[] = [];

  for (const item of sortedItems) {
    if (currentLineItems.length === 0) {
      currentLineItems.push(item);
      continue;
    }

    const lineHeight = currentLineItems[0].height || currentLineItems[0].fontSize;
    const tolerance = Math.max(3, Math.min(lineHeight, item.height || item.fontSize) * 0.5);

    if (Math.abs(item.y - currentLineItems[0].y) <= tolerance) {
      currentLineItems.push(item);
    } else {
      currentLineItems.sort((a, b) => a.x - b.x);
      const lineText = joinLineItems(currentLineItems);
      const avgFontSize =
        currentLineItems.reduce((acc, i) => acc + i.fontSize, 0) / currentLineItems.length;
      const typography = classifyTypography(avgFontSize, dominantFontSize, lineText);

      lines.push({
        items: currentLineItems,
        y: currentLineItems[0].y,
        height: Math.max(...currentLineItems.map((i) => i.height)),
        fontSize: avgFontSize,
        text: lineText,
        isHeading: typography.isHeading,
        headingLevel: typography.headingLevel,
      });

      currentLineItems = [item];
    }
  }

  if (currentLineItems.length > 0) {
    currentLineItems.sort((a, b) => a.x - b.x);
    const lineText = joinLineItems(currentLineItems);
    const avgFontSize =
      currentLineItems.reduce((acc, i) => acc + i.fontSize, 0) / currentLineItems.length;
    const typography = classifyTypography(avgFontSize, dominantFontSize, lineText);

    lines.push({
      items: currentLineItems,
      y: currentLineItems[0].y,
      height: Math.max(...currentLineItems.map((i) => i.height)),
      fontSize: avgFontSize,
      text: lineText,
      isHeading: typography.isHeading,
      headingLevel: typography.headingLevel,
    });
  }

  // 2. Gom dòng thành các khối đoạn văn bản / đề mục
  const blocks: string[] = [];
  const headings: Array<{ title: string; level: 1 | 2 | 3 }> = [];
  let currentBlockText = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.text) continue;

    if (line.isHeading && line.headingLevel) {
      if (currentBlockText.trim()) {
        blocks.push(dehyphenateText(currentBlockText.trim()));
        currentBlockText = "";
      }

      const prefix = "#".repeat(line.headingLevel);
      const cleanHeadingTitle = line.text.replace(/^#+\s*/, "").trim();
      blocks.push(`${prefix} ${cleanHeadingTitle}`);
      headings.push({
        title: cleanHeadingTitle,
        level: line.headingLevel,
      });
      continue;
    }

    if (!currentBlockText) {
      currentBlockText = line.text;
      continue;
    }

    const prevLine = lines[i - 1];
    const gapY = line.y - (prevLine.y + prevLine.height);
    const isNewParagraph =
      gapY > dominantFontSize * 0.8 ||
      gapY < -3 || // Chuyển cột mới (tọa độ y nhảy ngược lên đỉnh)
      prevLine.isHeading ||
      /^(?:[-*•]|\d+\.)\s+/.test(line.text);

    if (isNewParagraph) {
      blocks.push(dehyphenateText(currentBlockText.trim()));
      currentBlockText = line.text;
    } else {
      currentBlockText = joinLinesWithDehyphenation(currentBlockText, line.text);
    }
  }

  if (currentBlockText.trim()) {
    blocks.push(dehyphenateText(currentBlockText.trim()));
  }

  const pageText = blocks.join("\n\n");
  return { pageText, headings };
}

/**
 * Trích xuất text đơn giản từ PDF (giữ nguyên cho backward compatibility)
 */
export async function extractTextFromPdf(
  fileOrBuffer: File | ArrayBuffer | Uint8Array
): Promise<string> {
  const structured = await extractStructuredPdf(fileOrBuffer, 9999);
  return structured.chunks.map((c) => c.rawText).join("\n\n");
}

export interface PdfExtractionProgress {
  stage: "loading" | "parsing_pages" | "sorting_layout" | "building_chunks" | "complete";
  current: number;
  total: number;
  percent: number;
  message?: string;
}

/**
 * Trích xuất PDF có cấu trúc cao cấp dựa trên hình học (Layout & Geometry-Aware PDF Extraction)
 * - Thu thập TextItem kèm tọa độ [x, y, width, height], fontSize từ transform matrix.
 * - Header/Footer Filter: Lọc bỏ header, footer, số trang lặp lại ở mép trên/dưới.
 * - Multi-column Sorting (XY-Cut): Tách các cột văn bản theo rãnh khoảng cách x, đọc hết cột 1 mới sang cột 2.
 * - Dehyphenation: Khử đứt đoạn từ khi bị gãy dòng có gạch nối.
 * - Typography Clustering: Phân loại Heading Level 1, 2, 3 chuẩn xác cho Table of Contents và Paragraph Blocks.
 * - Chia trang & phân chunk (mỗi chunk 10 trang để lazy load), giữ đúng interface StructuredDocumentMeta và DocumentChunk[].
 * - Non-blocking event loop yielding & Progress Callback.
 */
export async function extractStructuredPdf(
  fileOrBuffer: File | ArrayBuffer | Uint8Array,
  pagesPerChunk: number = PAGES_PER_CHUNK,
  maxPages?: number,
  onProgress?: (progress: PdfExtractionProgress) => void
): Promise<{
  meta: StructuredDocumentMeta;
  chunks: DocumentChunk[];
}> {
  onProgress?.({
    stage: "loading",
    current: 0,
    total: 100,
    percent: 5,
    message: "Đang nạp dữ liệu nhị phân PDF...",
  });

  let buffer: ArrayBuffer;
  if (fileOrBuffer instanceof File) {
    buffer = await fileOrBuffer.arrayBuffer();
  } else if (fileOrBuffer instanceof Uint8Array) {
    buffer = fileOrBuffer.buffer.slice(
      fileOrBuffer.byteOffset,
      fileOrBuffer.byteOffset + fileOrBuffer.byteLength
    ) as ArrayBuffer;
  } else {
    buffer = fileOrBuffer;
  }

  const uint8 = new Uint8Array(buffer);

  // 1. Tải Document Proxy từ unpdf
  const proxy = await getDocumentProxy(uint8);
  const totalPages = Math.max(
    1,
    Math.min(proxy.numPages, maxPages && maxPages > 0 ? maxPages : proxy.numPages)
  );

  // 2. Thu thập TextItem đầy đủ tọa độ [x, y, width, height] và fontSize cho từng trang
  const rawPagesItems: PdfGeometryItem[][] = [];
  const pageDimensions: Array<{ width: number; height: number }> = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await proxy.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    pageDimensions.push({ width: viewport.width, height: viewport.height });

    const textContent = await page.getTextContent();
    const pageItems = extractGeometryItemsFromPage(
      textContent.items as Array<{
        str?: string;
        transform?: number[];
        width?: number;
        height?: number;
        fontName?: string;
        hasEOL?: boolean;
      }>,
      viewport.height
    );
    rawPagesItems.push(pageItems);

    if (pageNum % 10 === 0 || pageNum === totalPages) {
      onProgress?.({
        stage: "parsing_pages",
        current: pageNum,
        total: totalPages,
        percent: Math.round(5 + (pageNum / totalPages) * 50),
        message: `Đang quét tọa độ trang ${pageNum}/${totalPages}...`,
      });
      // Yield to event loop để tránh block UI
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  const totalTextItems = rawPagesItems.reduce((acc, items) => acc + items.length, 0);
  const hasTextLayer =
    totalTextItems > 0 &&
    rawPagesItems.some((items) => items.some((i) => i.str && i.str.trim().length > 0));

  if (!hasTextLayer) {
    throw new Error(
      "Tài liệu PDF này không có text layer (có thể là file scan ảnh). Hãy dùng tính năng Tải ảnh OCR."
    );
  }

  // 3. Typography Clustering: Tính cỡ chữ phổ biến nhất (dominant / body font size)
  const allItems = rawPagesItems.flat();
  const dominantFontSize = computeDominantFontSize(allItems);

  // 4. Header/Footer Filter: Lọc header, footer, số trang lặp lại ở mép trên/dưới
  const filteredPagesItems = filterHeadersAndFooters(rawPagesItems, pageDimensions);

  // 5. Multi-column Sorting (XY-Cut) & Gom dòng, đoạn văn theo thứ tự đọc
  const extractedPages: string[] = [];
  const detectedHeadingsByPage: Map<number, Array<{ title: string; level: 1 | 2 | 3 }>> = new Map();

  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const pageNum = pIdx + 1;
    const pageItems = filteredPagesItems[pIdx] || [];
    const pageWidth = pageDimensions[pIdx]?.width || 600;

    // Sắp xếp thứ tự đọc từng cột (hết cột 1 mới sang cột 2)
    const sortedItems = sortItemsIntoReadingOrder(pageItems, pageWidth);

    // Gom thành đoạn văn markdown và phát hiện đề mục
    const { pageText, headings } = assemblePageText(sortedItems, dominantFontSize);
    extractedPages.push(pageText);

    if (headings.length > 0) {
      detectedHeadingsByPage.set(pageNum, headings);
    }
  }

  // 6. Trích xuất Table of Contents (TOC) từ PDF Outline hoặc Typography Headings
  const tocItems: TableOfContentItem[] = [];
  let tocCounter = 0;

  try {
    const outline = await proxy.getOutline();

    if (Array.isArray(outline) && outline.length > 0) {
      type OutlineItem = {
        title: string;
        dest?: unknown;
        items?: OutlineItem[];
      };

      const traverseOutline = (items: OutlineItem[], level: 1 | 2 | 3) => {
        for (const item of items) {
          if (!item.title) continue;
          const pageNum = Math.min(
            totalPages,
            Math.max(1, tocCounter + 1)
          );
          const chunkIdx = Math.floor((pageNum - 1) / pagesPerChunk);

          tocItems.push({
            id: `toc-outline-${tocCounter++}`,
            title: item.title.trim(),
            level,
            pageNumber: pageNum,
            chunkIndex: chunkIdx,
          });

          if (Array.isArray(item.items) && item.items.length > 0 && level < 3) {
            traverseOutline(item.items, (level + 1) as 1 | 2 | 3);
          }
        }
      };

      traverseOutline(outline as OutlineItem[], 1);
    }
  } catch {
    // Không đọc được outline metadata, tiếp tục dùng typography headings
  }

  // Nếu PDF không có outline metadata trong file, dùng Typography Headings đã bóc tách
  if (tocItems.length === 0) {
    const seenTitles = new Set<string>();

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pageHeadings = detectedHeadingsByPage.get(pageNum) || [];
      const chunkIdx = Math.floor((pageNum - 1) / pagesPerChunk);

      for (const h of pageHeadings) {
        const titleKey = `${pageNum}-${h.title.toLowerCase()}`;
        if (seenTitles.has(titleKey)) continue;
        seenTitles.add(titleKey);

        tocItems.push({
          id: `toc-heading-${tocCounter++}`,
          title: h.title.slice(0, 80),
          level: h.level,
          pageNumber: pageNum,
          chunkIndex: chunkIdx,
        });
      }
    }
  }

  // 7. Phân chia tài liệu thành các Chunks (mỗi chunk gồm N trang)
  const totalChunks = Math.ceil(totalPages / pagesPerChunk);
  const chunks: DocumentChunk[] = [];
  let totalWordCount = 0;

  for (let cIdx = 0; cIdx < totalChunks; cIdx++) {
    const startPage = cIdx * pagesPerChunk + 1;
    const endPage = Math.min((cIdx + 1) * pagesPerChunk, totalPages);
    const chunkPageTexts = extractedPages.slice(startPage - 1, endPage);

    const rawText = chunkPageTexts
      .map((p, i) => {
        const actualPageNum = startPage + i;
        const cleaned = p.replace(/\r\n/g, "\n").trim();
        return `<!-- Page ${actualPageNum} -->\n${cleaned}`;
      })
      .join("\n\n");

    const words = rawText.split(/\s+/).filter(Boolean).length;
    totalWordCount += words;

    // Tìm tiêu đề chương tương ứng với chunk này nếu có
    const chapterToc = tocItems.find((t) => t.chunkIndex === cIdx);

    chunks.push({
      chunkIndex: cIdx,
      startPage,
      endPage,
      chapterTitle: chapterToc?.title,
      rawText,
      totalWords: words,
    });
  }

  // Đảm bảo luôn có ít nhất 1 mục trong TOC
  if (tocItems.length === 0) {
    chunks.forEach((c) => {
      tocItems.push({
        id: `toc-chunk-${c.chunkIndex}`,
        title: `Phần ${c.chunkIndex + 1} (Trang ${c.startPage} - ${c.endPage})`,
        level: 1,
        pageNumber: c.startPage,
        chunkIndex: c.chunkIndex,
      });
    });
  }

  const docId = `doc-pdf-${Date.now()}`;
  const meta: StructuredDocumentMeta = {
    id: docId,
    title: "Tài liệu PDF",
    sourceType: "pdf",
    totalPages,
    totalChunks,
    pagesPerChunk,
    totalWords: totalWordCount,
    totalSentences: Math.round(totalWordCount / 15),
    toc: tocItems,
    activeChunkIndex: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  onProgress?.({
    stage: "complete",
    current: totalPages,
    total: totalPages,
    percent: 100,
    message: "Hoàn tất trích xuất cấu trúc tài liệu!",
  });

  return { meta, chunks };
}

/**
 * Trích xuất có cấu trúc từ file Word (.docx)
 * Sử dụng mammoth chuyển đổi sang Markdown và phân tách cây đề mục
 */
export async function extractStructuredDocx(
  fileOrBuffer: File | ArrayBuffer | Uint8Array,
  pagesPerChunk: number = PAGES_PER_CHUNK
): Promise<{
  meta: StructuredDocumentMeta;
  chunks: DocumentChunk[];
}> {
  let buffer: ArrayBuffer;
  if (fileOrBuffer instanceof File) {
    buffer = await fileOrBuffer.arrayBuffer();
  } else if (fileOrBuffer instanceof Uint8Array) {
    buffer = fileOrBuffer.buffer.slice(
      fileOrBuffer.byteOffset,
      fileOrBuffer.byteOffset + fileOrBuffer.byteLength
    ) as ArrayBuffer;
  } else {
    buffer = fileOrBuffer;
  }

  const conversion = await mammoth.convertToMarkdown({ arrayBuffer: buffer });
  const markdown = conversion.value.trim();

  if (!markdown) {
    throw new Error("Không thể đọc được nội dung từ file Word (.docx).");
  }

  return extractStructuredText(
    markdown,
    "Tài liệu Word",
    pagesPerChunk,
    "docx"
  );
}

/**
 * Chuẩn hóa văn bản text/markdown thành Structured Document (Chunks + TOC)
 */
export function extractStructuredText(
  text: string,
  defaultTitle: string,
  pagesPerChunk: number = PAGES_PER_CHUNK,
  sourceType: "raw_text" | "docx" | "image" = "raw_text"
): {
  meta: StructuredDocumentMeta;
  chunks: DocumentChunk[];
} {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  const allWords = cleaned.split(/\s+/).filter(Boolean);
  const totalWords = allWords.length;
  const totalPages = Math.max(1, Math.ceil(totalWords / WORDS_PER_PAGE_ESTIMATE));
  const totalChunks = Math.max(1, Math.ceil(totalPages / pagesPerChunk));
  const wordsPerChunk = Math.ceil(totalWords / totalChunks);

  const tocItems: TableOfContentItem[] = [];
  const lines = cleaned.split("\n");
  let tocCounter = 0;
  let runningWordCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const wordsInLine = trimmed.split(/\s+/).filter(Boolean).length;
    runningWordCount += wordsInLine;

    // Bắt Markdown Headings
    if (/^#{1,3}\s+/.test(trimmed)) {
      const match = trimmed.match(/^(#{1,3})\s+(.*)$/);
      if (match) {
        const level = Math.min(3, match[1].length) as 1 | 2 | 3;
        const title = match[2].trim();
        const estPage = Math.max(
          1,
          Math.min(totalPages, Math.ceil(runningWordCount / WORDS_PER_PAGE_ESTIMATE))
        );
        const chunkIndex = Math.min(
          totalChunks - 1,
          Math.floor((estPage - 1) / pagesPerChunk)
        );

        tocItems.push({
          id: `toc-md-${tocCounter++}`,
          title,
          level,
          pageNumber: estPage,
          chunkIndex,
        });
      }
    } else if (/^(?:Chapter|Section|Part)\s+[\dIVXLCDM]+/i.test(trimmed)) {
      const estPage = Math.max(
        1,
        Math.min(totalPages, Math.ceil(runningWordCount / WORDS_PER_PAGE_ESTIMATE))
      );
      const chunkIndex = Math.min(
        totalChunks - 1,
        Math.floor((estPage - 1) / pagesPerChunk)
      );

      tocItems.push({
        id: `toc-sec-${tocCounter++}`,
        title: trimmed.slice(0, 60),
        level: 1,
        pageNumber: estPage,
        chunkIndex,
      });
    }
  }

  // Cắt text thành từng Chunks
  const chunks: DocumentChunk[] = [];
  const paragraphs = cleaned.split(/\n\s*\n+/);
  let currentChunkIndex = 0;
  let currentChunkParagraphs: string[] = [];
  let currentChunkWords = 0;

  for (const p of paragraphs) {
    const pWords = p.split(/\s+/).filter(Boolean).length;

    const lastP = currentChunkParagraphs[currentChunkParagraphs.length - 1];
    const isLastPComplete = lastP ? /[.!?:]\s*$/.test(lastP.trim()) : true;

    if (
      ((currentChunkWords + pWords > wordsPerChunk && isLastPComplete) ||
        currentChunkWords > wordsPerChunk * 1.3) &&
      currentChunkIndex < totalChunks - 1
    ) {
      const startPage = currentChunkIndex * pagesPerChunk + 1;
      const endPage = Math.min((currentChunkIndex + 1) * pagesPerChunk, totalPages);
      const chapterToc = tocItems.find((t) => t.chunkIndex === currentChunkIndex);

      chunks.push({
        chunkIndex: currentChunkIndex,
        startPage,
        endPage,
        chapterTitle: chapterToc?.title,
        rawText: currentChunkParagraphs.join("\n\n"),
        totalWords: currentChunkWords,
      });

      currentChunkIndex++;
      currentChunkParagraphs = [p];
      currentChunkWords = pWords;
    } else {
      currentChunkParagraphs.push(p);
      currentChunkWords += pWords;
    }
  }

  // Chunk cuối cùng
  const startPage = currentChunkIndex * pagesPerChunk + 1;
  const endPage = totalPages;
  const chapterToc = tocItems.find((t) => t.chunkIndex === currentChunkIndex);
  chunks.push({
    chunkIndex: currentChunkIndex,
    startPage,
    endPage,
    chapterTitle: chapterToc?.title,
    rawText: currentChunkParagraphs.join("\n\n"),
    totalWords: currentChunkWords,
  });

  // Đảm bảo có ít nhất 1 mục trong TOC
  if (tocItems.length === 0) {
    chunks.forEach((c) => {
      tocItems.push({
        id: `toc-chunk-${c.chunkIndex}`,
        title: c.chapterTitle || `Phần ${c.chunkIndex + 1} (Trang ${c.startPage} - ${c.endPage})`,
        level: 1,
        pageNumber: c.startPage,
        chunkIndex: c.chunkIndex,
      });
    });
  }

  const docId = `doc-${sourceType}-${Date.now()}`;
  const meta: StructuredDocumentMeta = {
    id: docId,
    title: defaultTitle,
    sourceType,
    totalPages,
    totalChunks: chunks.length,
    pagesPerChunk,
    totalWords,
    totalSentences: Math.round(totalWords / 15),
    toc: tocItems,
    activeChunkIndex: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return { meta, chunks };
}

/**
 * Trích xuất text từ ảnh bằng OCR (Tesseract.js)
 */
export async function extractTextFromImage(
  imageFile: File | Blob,
  onProgress?: (progressPercent: number, status: string) => void
): Promise<string> {
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  try {
    if (onProgress) onProgress(0.1, "Khởi tạo mô hình OCR tiếng Anh...");
    worker = await createWorker("eng");

    if (onProgress) onProgress(0.5, "Đang xử lý nhận diện ký tự...");
    const ret = await worker.recognize(imageFile);
    await worker.terminate();
    worker = null;

    if (onProgress) onProgress(1, "Hoàn thành nhận diện!");
    const extractedText = ret.data.text.trim();
    if (!extractedText) {
      throw new Error("Không nhận diện được đoạn văn bản tiếng Anh nào trong hình ảnh.");
    }

    return extractedText;
  } catch (err: unknown) {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // ignore
      }
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Lỗi nhận diện hình ảnh (OCR): ${msg}`);
  }
}
