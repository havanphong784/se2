import { extractText } from "unpdf";
import { createWorker } from "tesseract.js";

/**
 * Trích xuất text từ file PDF (client-side hoặc server-side an toàn không cần canvas)
 */
export async function extractTextFromPdf(fileOrBuffer: File | ArrayBuffer | Uint8Array): Promise<string> {
  try {
    let buffer: ArrayBuffer;
    if (fileOrBuffer instanceof File) {
      buffer = await fileOrBuffer.arrayBuffer();
    } else if (fileOrBuffer instanceof Uint8Array) {
      buffer = fileOrBuffer.buffer as ArrayBuffer;
    } else {
      buffer = fileOrBuffer;
    }

    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });

    if (!text || !text.trim()) {
      throw new Error("Tài liệu PDF này không có text layer (có thể là file scan dạng ảnh). Hãy thử dùng tính năng Tải ảnh OCR.");
    }

    // Làm sạch ký tự xuống dòng dư thừa từ PDF layout
    const cleanedText = text
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return cleanedText;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Không thể đọc file PDF: ${msg}`);
  }
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
