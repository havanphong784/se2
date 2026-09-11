import type {
  ClientAIConfig,
  DetectedPhrase,
  SentenceBreakdownResponse,
} from "@/types/reading";
import {
  ROLE_MAP,
  enrichSentenceBreakdown,
  repairTruncatedJson,
  safeParseSentenceBreakdown,
} from "./json-repair";

export { ROLE_MAP, enrichSentenceBreakdown, repairTruncatedJson, safeParseSentenceBreakdown };

export const DEFAULT_AI_CONFIG: ClientAIConfig = {
  provider: "local_tunnel",
  baseUrl: "http://localhost:11434/v1",
  model: "qwen2.5:3b",
  temperature: 0.1,
  autoAnalyzeOnClick: true,
};

export const LOCAL_STORAGE_AI_KEY = "vocabloom_ai_config";
export const LOCAL_STORAGE_CACHE_PREFIX = "vocabloom_analysis_cache_v2_";

// L1 In-memory Cache cho kết quả phân tích câu (0ms truy cập)
const analysisL1Cache = new Map<string, SentenceBreakdownResponse>();

// In-flight Deduplication: Tránh gửi nhiều request cùng lúc cho cùng một câu
const inFlightAnalysis = new Map<string, Promise<SentenceBreakdownResponse>>();

/**
 * System Prompt súc tích (< 180 tokens) tập trung giải thích ngữ pháp và tư duy đọc hiểu tự nhiên
 */
export const SYSTEM_PROMPT = `You are a bilingual English-Vietnamese linguist for Vocabloom reading assistant.
Analyze <target_sentence> considering <context_before> and <context_after> in natural Vietnamese.
RULES:
1. Technical Terms: Keep IT/tech terms in English (CPU, RAM, API, cache...).
2. Return ONLY a valid JSON object with these EXACT keys:
{
  "complexity": "simple" | "compound" | "complex",
  "translationVi": "Bản dịch tiếng Việt tự nhiên",
  "coreIdeaVi": "Ý chính của câu trong 1 câu ngắn",
  "simplifiedEnglish": "Viết lại bằng tiếng Anh đơn giản",
  "skeleton": {
    "pattern": "S + V + O + A",
    "parts": [{"type": "S", "text": "..."}, {"type": "V", "text": "..."}]
  },
  "chunks": [{"chunkText": "...", "meaningVi": "...", "type": "noun_phrase" | "verb_phrase" | "prep_phrase"}],
  "clauses": [{"clauseText": "...", "role": "Main Clause", "subject": "...", "verb": "...", "objectOrComplement": "..."}],
  "grammar": {
    "ruleSummary": "Tên cấu trúc",
    "whyUsedVi": "Mục đích sử dụng của tác giả",
    "mechanicVi": "Giải thích cơ chế ngữ pháp"
  },
  "vocabulary": [{"term": "...", "meaningVi": "...", "type": "noun", "contextNoteVi": "..."}],
  "mentalModelSteps": [{"stepNumber": 1, "anchorText": "...", "actionVi": "...", "cognitiveWhyVi": "..."}]
}`;

/**
 * Strict JSON Schema tương thích OpenAI & Ollama Structured Output
 * Tinh gọn: bỏ 'sentence' (client tự map), bỏ 'ipa' (client map từ dictionary-cache),
 * bỏ 'wordFamily' bắt buộc, nén output còn ~400-500 tokens.
 */
export const SENTENCE_BREAKDOWN_JSON_SCHEMA = {
  name: "sentence_breakdown",
  strict: true,
  schema: {
    type: "object",
    properties: {
      complexity: {
        type: "string",
        enum: ["micro", "simple", "compound", "complex"],
        description: "Sentence grammatical complexity",
      },
      translationVi: {
        type: "string",
        description: "Natural Vietnamese contextual translation",
      },
      coreIdeaVi: {
        type: "string",
        description: "Core meaning in 1 concise Vietnamese sentence",
      },
      skeleton: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "e.g. S + V + O + A" },
          parts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["S", "V", "O", "C", "A"] },
                text: { type: "string" },
              },
              required: ["type", "text"],
              additionalProperties: false,
            },
          },
        },
        required: ["pattern", "parts"],
        additionalProperties: false,
      },
      chunks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            chunkText: { type: "string" },
            meaningVi: { type: "string" },
            type: { type: "string" },
          },
          required: ["chunkText", "meaningVi", "type"],
          additionalProperties: false,
        },
      },
      clauses: {
        type: "array",
        items: {
          type: "object",
          properties: {
            clauseText: { type: "string" },
            role: { type: "string" },
            subject: { type: "string" },
            verb: { type: "string" },
            objectOrComplement: { type: "string" },
          },
          required: ["clauseText", "role", "subject", "verb", "objectOrComplement"],
          additionalProperties: false,
        },
      },
      vocabulary: {
        type: "array",
        items: {
          type: "object",
          properties: {
            term: { type: "string" },
            partOfSpeech: { type: "string" },
            contextMeaningVi: { type: "string" },
            cefr: { type: "string" },
            isTechnicalTerm: { type: "boolean" },
          },
          required: ["term", "partOfSpeech", "contextMeaningVi", "isTechnicalTerm"],
          additionalProperties: false,
        },
      },
      idiomsAndPhrases: {
        type: "array",
        items: {
          type: "object",
          properties: {
            phrase: { type: "string" },
            meaningVi: { type: "string" },
          },
          required: ["phrase", "meaningVi"],
          additionalProperties: false,
        },
      },
      grammar: {
        type: "object",
        properties: {
          pattern: { type: "string" },
          explanation: { type: "string" },
          ruleSummary: { type: "string" },
          whyUsedVi: { type: "string" },
          mechanicVi: { type: "string" },
        },
        required: ["pattern", "explanation", "whyUsedVi", "mechanicVi"],
        additionalProperties: false,
      },
      mentalModelSteps: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: [
      "complexity",
      "translationVi",
      "coreIdeaVi",
      "skeleton",
      "chunks",
      "clauses",
      "vocabulary",
      "idiomsAndPhrases",
      "grammar",
      "mentalModelSteps",
    ],
    additionalProperties: false,
  },
};

/**
 * Lấy cấu hình AI đã lưu trong localStorage hoặc trả về mặc định
 */
export function getSavedAIConfig(): ClientAIConfig {
  if (typeof window === "undefined") return DEFAULT_AI_CONFIG;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AI_KEY);
    if (!raw) return DEFAULT_AI_CONFIG;
    return { ...DEFAULT_AI_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_AI_CONFIG;
  }
}

/**
 * Lưu cấu hình AI vào localStorage
 */
export function saveAIConfig(config: ClientAIConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_AI_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Failed to save AI config to localStorage", e);
  }
}

/**
 * Tính mã băm đơn giản (FNV-1a 32-bit hex) của câu để làm key lưu cache
 */
export function getSentenceHash(sentence: string): string {
  const str = sentence.trim().toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Lấy kết quả phân tích đã lưu trong L1 (RAM) hoặc L2 (LocalStorage)
 */
export function getCachedAnalysis(sentence: string): SentenceBreakdownResponse | null {
  const hash = getSentenceHash(sentence);
  if (analysisL1Cache.has(hash)) {
    return analysisL1Cache.get(hash)!;
  }

  if (typeof window === "undefined") return null;
  try {
    const key = LOCAL_STORAGE_CACHE_PREFIX + hash;
    const item = localStorage.getItem(key);
    if (!item) return null;
    const parsed = JSON.parse(item) as SentenceBreakdownResponse;
    analysisL1Cache.set(hash, parsed);
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Lưu kết quả phân tích vào cache L1 và L2
 */
export function setCachedAnalysis(sentence: string, analysis: SentenceBreakdownResponse): void {
  const hash = getSentenceHash(sentence);
  analysisL1Cache.set(hash, analysis);

  if (typeof window === "undefined") return;
  try {
    const key = LOCAL_STORAGE_CACHE_PREFIX + hash;
    localStorage.setItem(key, JSON.stringify(analysis));
  } catch (e) {
    console.warn("Storage full or unable to cache analysis", e);
  }
}

/**
 * Nạp hàng loạt kết quả phân tích vào L1 RAM cache (0ms truy cập)
 */
export function primeSentenceAnalysisCache(
  analyses: Record<string, SentenceBreakdownResponse>
): void {
  if (!analyses || typeof analyses !== "object") return;
  for (const [key, item] of Object.entries(analyses)) {
    if (!item) continue;
    const targetSentence = item.sentence?.trim() ? item.sentence : "";
    const hash = targetSentence ? getSentenceHash(targetSentence) : key;
    analysisL1Cache.set(hash, item);
    if (key && key !== hash) {
      analysisL1Cache.set(key, item);
    }
  }
}

/**
 * Kiểm tra xem câu đã có trong cache L1 hoặc L2 chưa
 */
export function hasCachedAnalysis(sentence: string): boolean {
  const hash = getSentenceHash(sentence);
  if (analysisL1Cache.has(hash)) return true;
  return Boolean(getCachedAnalysis(sentence));
}

/**
 * Xóa sạch toàn bộ cache phân tích câu (L1 RAM cache và L2 localStorage)
 */
export function clearSentenceAnalysisCache(): void {
  analysisL1Cache.clear();
  inFlightAnalysis.clear();
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LOCAL_STORAGE_CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch (e) {
    console.warn("Failed to clear localStorage analysis cache", e);
  }
}

/**
 * Lấy bản dịch câu siêu tốc (~100ms) qua API nội bộ để hiển thị bản nháp tức thì
 */
export async function fetchFastSentenceTranslation(sentence: string): Promise<string> {
  if (!sentence.trim()) return "";
  try {
    const res = await fetch(`/api/reading/lookup?sentence=${encodeURIComponent(sentence.trim())}`);
    if (!res.ok) return "";
    const json = (await res.json()) as { translationVi?: string };
    return json.translationVi?.trim() || "";
  } catch {
    return "";
  }
}

/**
 * Tạo bản nháp phân tích tức thời (Instant Draft) 0-100ms
 * Giúp giao diện hiển thị ngay lập tức trong lúc AI bóc tách ngữ pháp chuyên sâu ở background
 */
export function createInstantSentenceDraft(
  sentence: string,
  preliminaryTranslation: string = ""
): SentenceBreakdownResponse {
  return {
    sentence,
    complexity: "simple",
    translationVi: preliminaryTranslation,
    coreIdeaVi: "",
    skeleton: {
      pattern: "Đang phân tích...",
      parts: [],
    },
    chunks: [],
    grammar: {
      pattern: "Đang phân tích cấu trúc...",
      explanation: "AI đang phân tích ngữ pháp, các mệnh đề S-V-O và ngữ cảnh...",
      ruleSummary: "",
      whyUsedVi: "",
      mechanicVi: "",
      clauses: [],
    },
    vocabulary: [],
    idiomsAndPhrases: [],
    mentalModelSteps: [],
    simplifiedEnglish: "",
  };
}

/**
 * Kiểm tra kết nối tới Endpoint AI (Ping /models hoặc /chat/completions)
 */
export async function testAIConnection(
  baseUrl: string,
  apiKey?: string
): Promise<{ ok: boolean; message: string; availableModels?: string[] }> {
  try {
    const cleanUrl = baseUrl.replace(/\/+$/, "");
    const modelsUrl = `${cleanUrl}/models`;

    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const res = await fetch(modelsUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = await res.json();
      const models = Array.isArray(data.data)
        ? data.data.map((m: { id?: string }) => m.id).filter(Boolean)
        : [];
      return {
        ok: true,
        message: "Kết nối thành công! Đã tìm thấy danh sách model.",
        availableModels: models,
      };
    }

    return {
      ok: false,
      message: `Không thể lấy danh mục model (Mã phản hồi: ${res.status}). Vui lòng kiểm tra lại URL tunnel.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      return {
        ok: false,
        message:
          "Không thể kết nối (Lỗi Mạng/Mixed Content). Hãy chắc chắn bạn dùng URL HTTPS từ Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:11434`) nếu đang truy cập web qua domain ngoài.",
      };
    }
    return { ok: false, message: `Lỗi kết nối: ${msg}` };
  }
}

/**
 * Gọi AI phân tích bóc tách câu chuyên sâu với Sliding Window Context & Strict Output Schema
 * (hỗ trợ Client-side Enrichment, safeParse và Request Deduplication)
 */
export async function analyzeSentence(
  sentence: string,
  contextOrWindow: string,
  config: ClientAIConfig,
  detectedPhrases?: Array<DetectedPhrase | string>
): Promise<SentenceBreakdownResponse> {
  // 1. Kiểm tra cache trước
  const cached = getCachedAnalysis(sentence);
  if (
    cached &&
    (cached.grammar?.clauses?.length > 0 ||
      (cached.skeleton?.parts && cached.skeleton.parts.length > 0) ||
      (cached.chunks && cached.chunks.length > 0) ||
      cached.simplifiedEnglish)
  ) {
    return cached;
  }

  // 2. Request Deduplication: Nếu câu này đang được phân tích ở request khác, dùng chung Promise
  const hash = getSentenceHash(sentence);
  if (inFlightAnalysis.has(hash)) {
    return inFlightAnalysis.get(hash)!;
  }

  const fetchPromise = (async () => {
    try {
      const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (config.apiKey) {
        headers["Authorization"] = `Bearer ${config.apiKey}`;
      }

      // Xây dựng User Prompt với XML Tags
      let userContent: string;
      if (contextOrWindow.includes("<target_sentence>")) {
        userContent = contextOrWindow;
        // Nếu đã có XML nhưng chưa có client_hints và caller truyền detectedPhrases:
        if (
          !userContent.includes("<client_hints>") &&
          detectedPhrases &&
          detectedPhrases.length > 0
        ) {
          const phraseNames = detectedPhrases
            .map((p) => (typeof p === "string" ? p.trim() : p.cleanPhrase || p.phraseText || ""))
            .filter(Boolean);
          if (phraseNames.length > 0) {
            userContent += `\n<client_hints>\nDetected phrases: ${phraseNames.join(", ")}\n</client_hints>`;
          }
        }
      } else {
        const phraseNames = (detectedPhrases || [])
          .map((p) => (typeof p === "string" ? p.trim() : p.cleanPhrase || p.phraseText || ""))
          .filter(Boolean);
        const hintsTag =
          phraseNames.length > 0
            ? `\n<client_hints>\nDetected phrases: ${phraseNames.join(", ")}\n</client_hints>`
            : "\n<client_hints></client_hints>";
        userContent = `<context_before>\n${contextOrWindow}\n</context_before>\n<target_sentence>\n${sentence}\n</target_sentence>\n<context_after></context_after>${hintsTag}`;
      }

      const requestBody: Record<string, unknown> = {
        model: config.model,
        temperature: config.temperature ?? 0.1,
        stream: false,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: {
          type: "json_schema",
          json_schema: SENTENCE_BREAKDOWN_JSON_SCHEMA,
        },
      };

      let res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(30000), // Timeout 30s
      });

      // Fallback 1: Nếu endpoint trả về 400 (không hỗ trợ json_schema), thử lại với type: "json_object"
      if (!res.ok && res.status === 400 && requestBody.response_format) {
        const retryBody = {
          ...requestBody,
          response_format: { type: "json_object" },
        };
        res = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(retryBody),
          signal: AbortSignal.timeout(30000),
        });

        // Fallback 2: Nếu proxy vẫn 400, bỏ hoàn toàn response_format
        if (!res.ok && res.status === 400) {
          const fallbackBody: Record<string, unknown> = { ...requestBody };
          delete fallbackBody.response_format;
          res = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(fallbackBody),
            signal: AbortSignal.timeout(30000),
          });
        }
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`AI Request Failed (${res.status}): ${errText.slice(0, 200)}`);
      }

      const responseText = await res.text();
      if (!responseText || !responseText.trim()) {
        throw new Error("Mô hình AI trả về kết quả rỗng.");
      }

      let rawContent = "";
      const trimmed = responseText.trim();

      // Xử lý cả response stream SSE lẫn JSON trực tiếp
      if (trimmed.startsWith("data:") || trimmed.includes("\ndata:")) {
        const lines = trimmed.split("\n");
        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine.startsWith("data:")) continue;
          const jsonStr = cleanLine.slice(5).trim();
          if (jsonStr === "[DONE]" || !jsonStr) continue;
          try {
            const chunk = JSON.parse(jsonStr);
            const delta =
              chunk.choices?.[0]?.delta?.content ??
              chunk.choices?.[0]?.message?.content ??
              "";
            rawContent += delta;
          } catch {
            // bỏ qua chunk lỗi
          }
        }
      } else {
        try {
          const json = JSON.parse(trimmed);
          rawContent =
            json.choices?.[0]?.message?.content ??
            json.choices?.[0]?.text ??
            json.content ??
            "";
        } catch {
          rawContent = trimmed;
        }
      }

      if (!rawContent || !rawContent.trim()) {
        throw new Error("Không nhận được nội dung phân tích từ AI.");
      }

      // Safe parse + repair JSON bị cắt cụt + client-side enrichment
      const parsed = safeParseSentenceBreakdown(rawContent, sentence);
      const enriched = enrichSentenceBreakdown(parsed);

      // Lưu vào cache L1 & L2
      setCachedAnalysis(sentence, enriched);

      return enriched;
    } finally {
      inFlightAnalysis.delete(hash);
    }
  })();

  inFlightAnalysis.set(hash, fetchPromise);
  return fetchPromise;
}
