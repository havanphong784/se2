import { CORE_TECH_LEXICON } from "./offline-lexicon";

export interface DictResult {
  phonetic?: string;
  definition?: string;
  translationVi?: string;
  synonyms?: string[];
}

// L1: In-memory Cache (RAM)
const l1Cache = new Map<string, DictResult>();

// L2 Storage Prefix
const L2_CACHE_PREFIX = "vocabloom_dict_v2_";

// Nạp tự động Offline Lexicon vào L1 Cache ngay khi khởi động module
let isOfflineLexiconSeeded = false;
export function seedOfflineLexicon(customLexicon?: Record<string, DictResult>): void {
  if (isOfflineLexiconSeeded && !customLexicon) return;
  const target = customLexicon || CORE_TECH_LEXICON;
  for (const [key, val] of Object.entries(target)) {
    const clean = key.toLowerCase().trim();
    if (!l1Cache.has(clean)) {
      l1Cache.set(clean, val);
    }
  }
  isOfflineLexiconSeeded = true;
}

// Khởi chạy nạp ngay
seedOfflineLexicon();

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
 * Đọc kết quả từ L1 (RAM) hoặc L2 (LocalStorage) - 0ms synchronous
 */
export function getCachedWord(word: string): DictResult | null {
  const clean = word.toLowerCase().trim();
  if (!clean) return null;

  // 1. Kiểm tra L1 RAM (0ms)
  if (l1Cache.has(clean)) {
    return l1Cache.get(clean)!;
  }

  // 2. Kiểm tra L2 LocalStorage (< 1ms)
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
 * Lưu kết quả vào cả L1 và L2, đảm bảo merge cẩn thận với cache hiện tại
 */
export function setCachedWord(word: string, result: DictResult): void {
  const clean = word.toLowerCase().trim();
  if (!clean) return;

  // Đọc từ getCachedWord (kiểm tra cả L1 và L2) để không ghi đè mất dữ liệu đã có
  const existing = getCachedWord(clean);
  const merged: DictResult = {
    phonetic: (result.phonetic && result.phonetic.trim()) || existing?.phonetic || "",
    definition: (result.definition && result.definition.trim()) || existing?.definition || "",
    translationVi: (result.translationVi && result.translationVi.trim()) || existing?.translationVi || "",
    synonyms: result.synonyms?.length ? result.synonyms : existing?.synonyms || [],
  };

  l1Cache.set(clean, merged);

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(L2_CACHE_PREFIX + clean, JSON.stringify(merged));
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
  ipa?: string,
  forceRefresh: boolean = false
): Promise<DictResult> {
  const clean = word.toLowerCase().trim();
  if (!clean) return { translationVi: contextMeaning || "" };

  // 1. Nếu có context meaning & ipa từ AI analysis và không phải forceRefresh, kết hợp lưu ngay
  if (!forceRefresh && contextMeaning && ipa) {
    const aiResult: DictResult = {
      phonetic: ipa,
      translationVi: contextMeaning,
    };
    setCachedWord(clean, aiResult);
    return aiResult;
  }

  // 2. Kiểm tra Cache L1/L2: chỉ dùng cache hit khi THỰC SỰ có translationVi khác rỗng
  const cached = getCachedWord(clean);
  if (!forceRefresh && cached && Boolean(cached.translationVi?.trim())) {
    if (contextMeaning && !cached.translationVi) {
      cached.translationVi = contextMeaning;
      setCachedWord(clean, cached);
    }
    return cached;
  }

  // 3. Request Deduplication: Nếu từ này đang có 1 request đang bay và không phải forceRefresh, dùng chung Promise
  if (!forceRefresh && inFlightRequests.has(clean)) {
    return inFlightRequests.get(clean)!;
  }

  const fetchPromise = (async () => {
    try {
      const res = await fetch(`/api/reading/lookup?word=${encodeURIComponent(clean)}`);
      if (!res.ok) {
        const fallback: DictResult = {
          phonetic: ipa || cached?.phonetic || "",
          definition: cached?.definition || "",
          translationVi: contextMeaning || cached?.translationVi || undefined,
          synonyms: cached?.synonyms || [],
        };
        if (fallback.translationVi) {
          setCachedWord(clean, fallback);
        }
        return fallback;
      }

      const json = await res.json();
      const result: DictResult = {
        phonetic: json.phonetic || ipa || cached?.phonetic || "",
        definition: json.definition || cached?.definition || "",
        translationVi: (json.translationVi && json.translationVi.trim()) || contextMeaning || cached?.translationVi || undefined,
        synonyms: (json.synonyms && json.synonyms.length > 0) ? json.synonyms : cached?.synonyms || [],
      };

      setCachedWord(clean, result);
      return result;
    } catch {
      const errFallback: DictResult = {
        phonetic: ipa || cached?.phonetic || "",
        definition: cached?.definition || "",
        translationVi: contextMeaning || cached?.translationVi || undefined,
        synonyms: cached?.synonyms || [],
      };
      if (errFallback.translationVi) {
        setCachedWord(clean, errFallback);
      }
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
let lastPrefetchSignature = "";

/**
 * Batch Prefetch Engine (Siêu tốc):
 * Gom từ vựng và cụm từ trong chunk văn bản chia thành các batch nhỏ (tối đa 20 từ)
 * gửi tới /api/reading/batch-lookup để nạp vào L1 RAM & LocalStorage.
 * Đảm bảo không abort vô cớ khi người dùng hover/click trong cùng một chunk văn bản.
 */
export async function prefetchDocumentWords(
  words: string[],
  phrases?: string[],
  maxToPrefetch: number = 60
): Promise<void> {
  if (typeof window === "undefined") return;

  // Tạo signature định danh chunk văn bản hiện tại
  const firstWord = words[0] || "";
  const midWord = words[Math.floor(words.length / 2)] || "";
  const lastWord = words[words.length - 1] || "";
  const phraseCount = phrases?.length || 0;
  const signature = `${words.length}:${phraseCount}:${firstWord}:${midWord}:${lastWord}`;

  // Tránh abort request vô cớ khi người dùng chỉ hover hoặc click trong cùng một chunk văn bản
  if (signature === lastPrefetchSignature) {
    // Nếu đang prefetch hoặc đã prefetch xong chunk này, không hủy ngang và không fetch lặp lại
    return;
  }

  // Hủy tiến trình prefetch của chunk CŨ nếu chuyển sang chunk MỚI
  if (prefetchAbortController) {
    prefetchAbortController.abort();
  }

  prefetchAbortController = new AbortController();
  const signal = prefetchAbortController.signal;
  lastPrefetchSignature = signature;

  const candidateWords: string[] = [];
  const seen = new Set<string>();

  // 1. Thêm các cụm từ trước (ưu tiên cao)
  if (phrases && phrases.length > 0) {
    for (const p of phrases) {
      const clean = p.toLowerCase().trim();
      if (clean.length >= 3 && !seen.has(clean)) {
        seen.add(clean);
        const cached = getCachedWord(clean);
        // Chỉ prefetch nếu chưa có trong cache hoặc chưa có translationVi
        if (!cached || !cached.translationVi?.trim()) {
          candidateWords.push(clean);
        }
      }
      if (candidateWords.length >= maxToPrefetch) break;
    }
  }

  // 2. Thêm các từ đơn
  for (const raw of words) {
    const clean = raw.toLowerCase().trim().replace(/^[^\w]+|[^\w]+$/g, "");
    if (
      clean.length >= 3 &&
      /^[a-z]+$/.test(clean) &&
      !STOP_WORDS.has(clean) &&
      !seen.has(clean)
    ) {
      seen.add(clean);
      const cached = getCachedWord(clean);
      // Chỉ prefetch nếu chưa có trong cache hoặc chưa có translationVi
      if (!cached || !cached.translationVi?.trim()) {
        candidateWords.push(clean);
      }
    }
    if (candidateWords.length >= maxToPrefetch) break;
  }

  if (candidateWords.length === 0) {
    return;
  }

  // Chia nhỏ mảng candidate thành các batch tối đa 20 từ/cụm từ
  // để Google Translate phân tách \n chính xác 100%, không bị nuốt dòng
  const BATCH_SIZE = 20;
  const batches: string[][] = [];
  for (let i = 0; i < candidateWords.length; i += BATCH_SIZE) {
    batches.push(candidateWords.slice(i, i + BATCH_SIZE));
  }

  try {
    await Promise.allSettled(
      batches.map(async (batch) => {
        const res = await fetch("/api/reading/batch-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ words: batch }),
          signal,
        });

        if (!res.ok) return;

        const data = (await res.json()) as {
          results?: Record<string, { word: string; translationVi: string }>;
        };

        if (data && data.results) {
          for (const [w, item] of Object.entries(data.results)) {
            if (item.translationVi && item.translationVi.trim()) {
              setCachedWord(w, {
                translationVi: item.translationVi.trim(),
              });
            }
          }
        }
      })
    );
  } catch {
    // Ignore abort or network error
  }
}
