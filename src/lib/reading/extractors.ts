import { extractText, getDocumentProxy } from "unpdf";
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
 * Trích xuất text đơn giản từ PDF (giữ nguyên cho backward compatibility)
 */
export async function extractTextFromPdf(
  fileOrBuffer: File | ArrayBuffer | Uint8Array
): Promise<string> {
  const structured = await extractStructuredPdf(fileOrBuffer, 9999);
  return structured.chunks.map((c) => c.rawText).join("\n\n");
}

/**
 * Trích xuất có cấu trúc từ file PDF:
 * - Chia trang & phân chunk (mỗi chunk 10 trang để lazy load)
 * - Đọc Table of Contents (TOC) từ PDF Outline hoặc thuật toán Heuristic
 */
export async function extractStructuredPdf(
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

  const uint8 = new Uint8Array(buffer);

  // 1. Trích xuất từng trang riêng biệt
  const result = await extractText(uint8, { mergePages: false });
  const totalPages = Math.max(1, result.totalPages);
  const rawPages: string[] = Array.isArray(result.text)
    ? result.text
    : [result.text || ""];

  if (rawPages.every((p) => !p || !p.trim())) {
    throw new Error(
      "Tài liệu PDF này không có text layer (có thể là file scan ảnh). Hãy dùng tính năng Tải ảnh OCR."
    );
  }

  // 2. Trích xuất Outline / Table of Contents
  const tocItems: TableOfContentItem[] = [];
  let tocCounter = 0;

  try {
    const proxy = await getDocumentProxy(uint8);
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
          // Ước lượng trang nếu có dest
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
    // Không đọc được outline metadata, chuyển sang Heuristic bên dưới
  }

  // Nếu PDF không có outline metadata, quét Heuristic từng trang tìm Heading
  if (tocItems.length === 0) {
    for (let pIdx = 0; pIdx < rawPages.length; pIdx++) {
      const pageText = rawPages[pIdx] || "";
      const lines = pageText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      // Quét 4 dòng đầu trang
      for (const line of lines.slice(0, 4)) {
        const isChapter = /^(?:chapter|section|part|unit)\s+[\dIVXLCDM]+/i.test(line);
        const isNumbered = /^[\d]+(?:\.[\d]+)*\s+[A-Z]/i.test(line);
        const isUpper =
          line.length >= 4 &&
          line.length <= 60 &&
          /^[A-Z0-9\s:—–-]+$/.test(line) &&
          !/^(page|\d+$)/i.test(line);

        if (isChapter || isNumbered || isUpper) {
          const pageNumber = pIdx + 1;
          const chunkIndex = Math.floor(pIdx / pagesPerChunk);
          tocItems.push({
            id: `toc-page-${pageNumber}-${tocCounter++}`,
            title: line.replace(/^#+\s*/, "").slice(0, 70),
            level: isChapter || isUpper ? 1 : 2,
            pageNumber,
            chunkIndex,
          });
          break; // Chỉ lấy 1 tiêu đề chính của trang
        }
      }
    }
  }

  // 3. Phân chia tài liệu thành các Chunks (mỗi chunk gồm N trang)
  const totalChunks = Math.ceil(totalPages / pagesPerChunk);
  const chunks: DocumentChunk[] = [];
  let totalWordCount = 0;

  for (let cIdx = 0; cIdx < totalChunks; cIdx++) {
    const startPage = cIdx * pagesPerChunk + 1;
    const endPage = Math.min((cIdx + 1) * pagesPerChunk, totalPages);
    const chunkPageTexts = rawPages.slice(startPage - 1, endPage);

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

    if (
      currentChunkWords + pWords > wordsPerChunk &&
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
