import type { ClientAIConfig, DocumentChunk } from "@/types/reading";
import { repairDocumentChunkAI } from "@/lib/ai/local-ai-client";
import { updateDocumentChunk } from "./indexed-storage";

export interface SemanticRepairQueueOptions {
  delayMs?: number;
  debounceMs?: number;
  onChunkRepaired?: (chunkIndex: number, repairedText: string) => void;
  onChunkStarted?: (chunkIndex: number) => void;
  onError?: (error: unknown, chunkIndex: number) => void;
  repairFn?: (rawText: string, config: ClientAIConfig) => Promise<string>;
}

/**
 * Kiểm tra xem chunk có cần sửa layout qua AI ở Pha 2 hay không
 * Gatekeeper: Bỏ qua các chunk có noiseScore < 2 (hoặc đã được sửa hoàn chỉnh)
 */
export function shouldRepairChunk(chunk: DocumentChunk): boolean {
  if (!chunk || !chunk.rawText || !chunk.rawText.trim()) {
    return false;
  }
  // Đã có bản sửa hoặc đã hoàn thành
  if (chunk.repairedRawText || chunk.repairStatus === "completed") {
    return false;
  }
  // Gatekeeper: Bỏ qua các chunk có noiseScore < 2
  if (typeof chunk.noiseScore === "number" && chunk.noiseScore < 2) {
    return false;
  }
  return true;
}

/**
 * Dynamic Prioritization:
 * Ưu tiên activeChunkIndex đầu tiên, kế đến là activeChunkIndex + 1, sau đó mới đến các chunk còn lại
 */
export function prioritizeChunkIndices(
  candidateIndices: number[],
  activeChunkIndex: number
): number[] {
  if (!candidateIndices || candidateIndices.length === 0) return [];
  const candidatesSet = new Set(candidateIndices);
  const prioritized: number[] = [];

  // 1. Ưu tiên activeChunkIndex đầu tiên
  if (candidatesSet.has(activeChunkIndex)) {
    prioritized.push(activeChunkIndex);
    candidatesSet.delete(activeChunkIndex);
  }

  // 2. Kế đến là activeChunkIndex + 1
  const nextIdx = activeChunkIndex + 1;
  if (candidatesSet.has(nextIdx)) {
    prioritized.push(nextIdx);
    candidatesSet.delete(nextIdx);
  }

  // 3. Các chunk còn lại: ưu tiên tiếp tục các chunk phía sau theo thứ tự đọc
  const remaining = Array.from(candidatesSet);
  remaining.sort((a, b) => {
    const distA = a >= activeChunkIndex ? a - activeChunkIndex : a + 10000;
    const distB = b >= activeChunkIndex ? b - activeChunkIndex : b + 10000;
    return distA - distB;
  });

  return [...prioritized, ...remaining];
}

/**
 * SemanticRepairQueue:
 * Quản lý hàng đợi sửa chunk tự động chạy nền với cơ chế Dynamic Prioritization và Gatekeeper
 */
export class SemanticRepairQueue {
  private options: SemanticRepairQueueOptions;
  private delayMs: number;
  private debounceMs: number;
  private isProcessing = false;
  private isCancelled = false;
  private docId: string | null = null;
  private chunks: DocumentChunk[] = [];
  private activeChunkIndex = 0;
  private aiConfig: ClientAIConfig | null = null;
  private queue: number[] = [];
  private currentProcessingIndex: number | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private delayTimer: NodeJS.Timeout | null = null;
  private delayResolve: (() => void) | null = null;

  constructor(options: SemanticRepairQueueOptions = {}) {
    this.options = options;
    this.delayMs = options.delayMs ?? 500;
    this.debounceMs = options.debounceMs ?? 50;
  }

  /**
   * Bắt đầu quét và đưa các chunk đủ điều kiện vào hàng đợi xử lý nền
   */
  public start(
    docId: string,
    chunks: DocumentChunk[],
    activeChunkIndex: number,
    aiConfig: ClientAIConfig
  ): void {
    this.cancel();

    this.docId = docId;
    this.chunks = [...chunks];
    this.activeChunkIndex = activeChunkIndex;
    this.aiConfig = aiConfig;
    this.isCancelled = false;

    // Gatekeeper lọc các chunk cần sửa
    const candidateIndices: number[] = [];
    for (const chunk of this.chunks) {
      if (shouldRepairChunk(chunk)) {
        candidateIndices.push(chunk.chunkIndex);
      } else if (
        typeof chunk.noiseScore === "number" &&
        chunk.noiseScore < 2 &&
        chunk.repairStatus !== "completed"
      ) {
        chunk.repairStatus = "skipped";
      }
    }

    if (candidateIndices.length === 0) {
      return;
    }

    // Áp dụng dynamic prioritization
    this.queue = prioritizeChunkIndices(candidateIndices, activeChunkIndex);

    // Bắt đầu xử lý với debounce
    if (this.debounceMs > 0) {
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        this.processQueue();
      }, this.debounceMs);
    } else {
      this.processQueue();
    }
  }

  /**
   * Chuyển đổi priority khi người dùng nhảy sang đọc chunk khác
   */
  public reprioritize(activeChunkIndex: number): void {
    this.activeChunkIndex = activeChunkIndex;

    if (this.queue.length === 0) return;

    // Lọc bỏ chunk đang xử lý ra khỏi danh sách cần sắp xếp lại
    const remaining = this.queue.filter((idx) => idx !== this.currentProcessingIndex);
    this.queue = prioritizeChunkIndices(remaining, activeChunkIndex);
  }

  /**
   * Hủy hàng đợi và dừng các tác vụ đang chờ
   */
  public cancel(): void {
    this.isCancelled = true;
    this.queue = [];
    this.isProcessing = false;
    this.currentProcessingIndex = null;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.delayTimer) {
      clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }
    if (this.delayResolve) {
      this.delayResolve();
      this.delayResolve = null;
    }
  }

  /**
   * Kiểm tra xem hàng đợi có đang hoạt động hay không
   */
  public isRunning(): boolean {
    return (
      !this.isCancelled &&
      (this.isProcessing || this.queue.length > 0 || this.debounceTimer !== null)
    );
  }

  /**
   * Lấy danh sách các chunkIndex còn đang chờ trong hàng đợi
   */
  public getPendingQueue(): number[] {
    return [...this.queue];
  }

  /**
   * Lấy chunkIndex hiện đang được xử lý
   */
  public getCurrentProcessingIndex(): number | null {
    return this.currentProcessingIndex;
  }

  /**
   * Vòng lặp xử lý tuần tự từng chunk trong hàng đợi
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.isCancelled) return;
    this.isProcessing = true;

    const repairChunk = this.options.repairFn ?? repairDocumentChunkAI;

    try {
      while (!this.isCancelled && this.queue.length > 0) {
        const nextIndex = this.queue.shift();
        if (nextIndex === undefined) break;

        const chunk = this.chunks.find((c) => c.chunkIndex === nextIndex);
        if (!chunk || !shouldRepairChunk(chunk)) {
          continue;
        }

        if (!this.aiConfig) {
          break;
        }

        this.currentProcessingIndex = nextIndex;
        this.options.onChunkStarted?.(nextIndex);
        chunk.repairStatus = "repairing";

        try {
          const repairedText = await repairChunk(chunk.rawText, this.aiConfig);

          if (this.isCancelled) break;

          chunk.repairedRawText = repairedText;
          chunk.repairStatus = "completed";

          if (this.docId) {
            await updateDocumentChunk(this.docId, chunk.chunkIndex, chunk).catch((err) => {
              console.warn(
                `SemanticRepairQueue: Failed to persist chunk ${chunk.chunkIndex} into IndexedDB:`,
                err
              );
            });
          }

          this.options.onChunkRepaired?.(chunk.chunkIndex, repairedText);
        } catch (err) {
          chunk.repairStatus = "pending";
          this.options.onError?.(err, nextIndex);
        } finally {
          this.currentProcessingIndex = null;
        }

        // Delay 500ms giữa các chunk để chống nghẽn tunnel/gateway
        if (!this.isCancelled && this.queue.length > 0) {
          await this.delay(this.delayMs);
        }
      }
    } finally {
      this.isProcessing = false;
      this.currentProcessingIndex = null;
    }
  }

  private delay(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      this.delayResolve = resolve;
      this.delayTimer = setTimeout(() => {
        this.delayTimer = null;
        this.delayResolve = null;
        resolve();
      }, ms);
    });
  }
}
