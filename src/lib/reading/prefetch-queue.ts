import type { ClientAIConfig, SentenceItem } from "@/types/reading";
import { buildSlidingWindowContext } from "./context-window";
import { detectPhrasesInSentence } from "./phrase-matcher";
import {
  analyzeSentence,
  hasCachedAnalysis,
  isCompleteSentenceAnalysis,
} from "@/lib/ai/local-ai-client";
import { saveSentenceAnalysis } from "./indexed-storage";

export interface PrefetchQueueOptions {
  debounceMs?: number;
  maxLookahead?: number;
  onSentencePrefetched?: (sentenceId: string, sentenceText: string) => void;
  onError?: (error: unknown, sentenceText: string) => void;
}

/**
 * Speculative Prefetch Queue: Hàng đợi phân tích đón đầu câu N+1, N+2 khi người dùng đọc câu N.
 * - Tự động debounce tránh spam request khi người dùng bấm next liên tục.
 * - Concurrency = 1 (tuần tự từng câu) để không làm nghẽn GPU/CPU của AI engine.
 * - Tự động hủy (abort) các request prefetch cũ khi người dùng nhảy sang đoạn khác.
 */
export class SpeculativePrefetchQueue {
  private debounceMs: number;
  private maxLookahead: number;
  private debounceTimer: NodeJS.Timeout | null = null;
  private activeAbortController: AbortController | null = null;
  private isProcessing = false;
  private onSentencePrefetched?: (sentenceId: string, sentenceText: string) => void;
  private onError?: (error: unknown, sentenceText: string) => void;

  constructor(options: PrefetchQueueOptions = {}) {
    this.debounceMs = options.debounceMs ?? 1200;
    this.maxLookahead = options.maxLookahead ?? 2;
    this.onSentencePrefetched = options.onSentencePrefetched;
    this.onError = options.onError;
  }

  /**
   * Đặt lịch prefetch đón đầu cho các câu tiếp theo tính từ currentIndex
   */
  public enqueue(
    allSentences: SentenceItem[],
    currentIndex: number,
    aiConfig: ClientAIConfig,
    documentId?: string
  ): void {
    this.cancel();

    if (!allSentences || allSentences.length === 0 || currentIndex < 0) {
      return;
    }

    // Xác định danh sách các câu tiếp theo cần prefetch (N+1, N+2, ...)
    const candidateSentences: Array<{ sentence: SentenceItem; index: number }> = [];
    for (
      let i = currentIndex + 1;
      i <= Math.min(currentIndex + this.maxLookahead, allSentences.length - 1);
      i++
    ) {
      const s = allSentences[i];
      if (s && !hasCachedAnalysis(s.text)) {
        candidateSentences.push({ sentence: s, index: i });
      }
    }

    if (candidateSentences.length === 0) {
      return;
    }

    // Debounce trước khi chạy request nền
    this.debounceTimer = setTimeout(() => {
      this.processQueue(allSentences, candidateSentences, aiConfig, documentId);
    }, this.debounceMs);
  }

  /**
   * Xử lý tuần tự từng câu trong danh sách candidate
   */
  private async processQueue(
    allSentences: SentenceItem[],
    candidates: Array<{ sentence: SentenceItem; index: number }>,
    aiConfig: ClientAIConfig,
    documentId?: string
  ): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.activeAbortController = new AbortController();
    const signal = this.activeAbortController.signal;

    try {
      for (const { sentence, index } of candidates) {
        if (signal.aborted) break;
        if (hasCachedAnalysis(sentence.text)) continue;

        const detected = detectPhrasesInSentence(sentence.text, sentence.tokens);
        const contextWindow = buildSlidingWindowContext(
          allSentences,
          index,
          detected.phrases
        );

        try {
          const result = await analyzeSentence(
            sentence.text,
            contextWindow,
            aiConfig,
            detected.phrases
          );

          if (signal.aborted) break;

          if (documentId && result && isCompleteSentenceAnalysis(result)) {
            await saveSentenceAnalysis(documentId, sentence.text, result).catch(() => {});
          }

          this.onSentencePrefetched?.(sentence.id, sentence.text);
        } catch (err) {
          if (!signal.aborted) {
            this.onError?.(err, sentence.text);
          }
        }
      }
    } finally {
      this.isProcessing = false;
      this.activeAbortController = null;
    }
  }

  /**
   * Hủy toàn bộ timer và tiến trình prefetch đang chạy
   */
  public cancel(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
    this.isProcessing = false;
  }

  /**
   * Kiểm tra xem queue có đang chạy prefetch ngầm không
   */
  public getIsRunning(): boolean {
    return this.isProcessing || this.debounceTimer !== null;
  }
}
