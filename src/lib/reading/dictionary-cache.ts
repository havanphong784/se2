export interface DictResult {
  phonetic?: string;
  definition?: string;
  translationVi?: string;
  synonyms?: string[];
}

// L1: In-memory Cache (RAM)
const l1Cache = new Map<string, DictResult>();

// L2 Storage Prefix
const L2_CACHE_PREFIX = "vocabloom_dict_v1_";

// In-flight Request Deduplication: Tránh gửi nhiều request cùng lúc cho 1 từ
const inFlightRequests = new Map<string, Promise<DictResult>>();

// Danh sách các stop words tiếng Anh cơ bản (không cần tốn tài nguyên prefetch)
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "because", "as", "what",
  "which", "this", "that", "these", "those", "then", "just", "so", "than",
  "such", "both", "through", "about", "for", "is", "of", "while", "during",
  "to", "from", "in", "out", "on", "off", "over", "under", "again", "further",
  "then", "once", "here", "there", "when", "where", "why", "how", "all", "any",
  "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor",
  "not", "only", "own", "same", "so", "than", "too", "very", "can", "will",
  "just", "don", "should", "now", "it", "its", "they", "them", "their", "we",
  "our", "you", "your", "he", "him", "his", "she", "her", "i", "me", "my",
  "be", "been", "being", "have", "has", "had", "do", "does", "did", "am", "are", "was", "were"
]);

/**
 * Đọc kết quả từ L1 (RAM) hoặc L2 (LocalStorage)
 */
export function getCachedWord(word: string): DictResult | null {
  const clean = word.toLowerCase().trim();
  if (!clean) return null;

  // 1. Kiểm tra L1 RAM
  if (l1Cache.has(clean)) {
    return l1Cache.get(clean)!;
  }

  // 2. Kiểm tra L2 LocalStorage
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(L2_CACHE_PREFIX + clean);
      if (stored) {
        const parsed = JSON.parse(stored) as DictResult;
        l1Cache.set(clean, parsed); // Thăng hạng lên L1
        return parsed;
      }
    } catch {
      // LocalStorage error fallback
    }
  }

  return null;
}

/**
 * Lưu kết quả vào cả L1 và L2
 */
export function setCachedWord(word: string, result: DictResult): void {
  const clean = word.toLowerCase().trim();
  if (!clean) return;

  l1Cache.set(clean, result);

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(L2_CACHE_PREFIX + clean, JSON.stringify(result));
    } catch {
      // Tránh crash nếu localStorage đầy
    }
  }
}

/**
 * Tra cứu thông tin từ vựng có cơ chế Cache 2 tầng & Request Deduplication
 */
export async function fetchWordDetails(
  word: string,
  contextMeaning?: string,
  ipa?: string
): Promise<DictResult> {
  const clean = word.toLowerCase().trim();

  // 1. Nếu có context meaning & ipa từ AI analysis, kết hợp lưu ngay
  if (contextMeaning && ipa) {
    const aiResult: DictResult = {
      phonetic: ipa,
      translationVi: contextMeaning,
    };
    setCachedWord(clean, aiResult);
    return aiResult;
  }

  // 2. Kiểm tra Cache L1/L2
  const cached = getCachedWord(clean);
  if (cached) {
    if (contextMeaning && !cached.translationVi) {
      cached.translationVi = contextMeaning;
      setCachedWord(clean, cached);
    }
    return cached;
  }

  // 3. Request Deduplication: Nếu từ này đang có 1 request đang bay, dùng chung Promise
  if (inFlightRequests.has(clean)) {
    return inFlightRequests.get(clean)!;
  }

  const fetchPromise = (async () => {
    try {
      const res = await fetch(`/api/reading/lookup?word=${encodeURIComponent(clean)}`);
      if (!res.ok) {
        const fallback: DictResult = { translationVi: contextMeaning || "Từ vựng" };
        setCachedWord(clean, fallback);
        return fallback;
      }

      const json = await res.json();
      const result: DictResult = {
        phonetic: json.phonetic || ipa || "",
        definition: json.definition || "",
        translationVi: contextMeaning || undefined,
        synonyms: json.synonyms || [],
      };

      setCachedWord(clean, result);
      return result;
    } catch {
      const errFallback: DictResult = { translationVi: contextMeaning || "Từ vựng" };
      setCachedWord(clean, errFallback);
      return errFallback;
    } finally {
      inFlightRequests.delete(clean);
    }
  })();

  inFlightRequests.set(clean, fetchPromise);
  return fetchPromise;
}

// Global Prefetch Controller để có thể hủy khi đổi bài đọc
let prefetchAbortController: AbortController | null = null;

/**
 * Background Prefetch Engine:
 * Tự động dịch và lấy dữ liệu ngầm cho các từ trong bài khi CPU rảnh (requestIdleCallback)
 * với tốc độ kiểm soát (throttled) để không gây nghẽn mạng hay quá tải API.
 */
export function prefetchDocumentWords(
  words: string[],
  maxToPrefetch: number = 40
): void {
  if (typeof window === "undefined") return;

  // Hủy tiến trình prefetch cũ nếu có
  if (prefetchAbortController) {
    prefetchAbortController.abort();
  }

  prefetchAbortController = new AbortController();
  const signal = prefetchAbortController.signal;

  // Lọc các từ cần prefetch:
  // - Độ dài >= 3
  // - Không phải số hoặc ký tự đặc biệt
  // - Không nằm trong STOP_WORDS
  // - Chưa có trong L1/L2 Cache
  const candidateWords: string[] = [];
  const seen = new Set<string>();

  for (const raw of words) {
    const clean = raw.toLowerCase().trim().replace(/^[^\w]+|[^\w]+$/g, "");
    if (
      clean.length >= 3 &&
      /^[a-z]+$/.test(clean) &&
      !STOP_WORDS.has(clean) &&
      !seen.has(clean)
    ) {
      seen.add(clean);
      if (!getCachedWord(clean)) {
        candidateWords.push(clean);
      }
    }
    if (candidateWords.length >= maxToPrefetch) break;
  }

  if (candidateWords.length === 0) return;

  // Chạy hàng đợi tải ngầm với Concurrency = 2, delay giữa các request = 150ms
  let currentIndex = 0;
  const CONCURRENCY = 2;
  const DELAY_MS = 150;

  async function worker() {
    while (currentIndex < candidateWords.length && !signal.aborted) {
      const word = candidateWords[currentIndex++];
      if (!word) break;

      try {
        await fetchWordDetails(word);
      } catch {
        // Tự bỏ qua nếu lỗi
      }

      if (signal.aborted) break;

      // Nhường CPU cho các tác vụ chính của người dùng
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  const runTask = () => {
    if (signal.aborted) return;
    for (let i = 0; i < CONCURRENCY; i++) {
      worker();
    }
  };

  // Ưu tiên chạy khi trình duyệt ở trạng thái nhàn rỗi (requestIdleCallback)
  if ("requestIdleCallback" in window) {
    (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(
      runTask,
      { timeout: 1500 }
    );
  } else {
    setTimeout(runTask, 300);
  }
}
