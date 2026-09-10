import type {
  ClauseBreakdown,
  ClientAIConfig,
  SentenceBreakdownResponse,
} from "@/types/reading";

export const ROLE_MAP: Record<string, string> = {
  S: "Chủ ngữ",
  V: "Động từ",
  O: "Tân ngữ",
  C: "Bổ ngữ",
  A: "Trạng ngữ",
};

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
 * Gọi AI phân tích bóc tách câu chuyên sâu (có Request Deduplication & In-Memory Cache)
 */
export async function analyzeSentence(
  sentence: string,
  contextParagraph: string,
  config: ClientAIConfig
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

      // System Prompt Schema-First súc tích
      const systemPrompt = `You are a bilingual English-Vietnamese linguist for Vocabloom. Analyze the target sentence in context to teach the learner HOW to understand its structure.

RULES:
1. Technical Terms: Keep IT/tech terms in English (API, database, cache, token...). Mark isTechnicalTerm: true.
2. Adaptive: For short/micro commands, keep clauses and wordFamily minimal.
3. Grammar: Focus on "why" the author used this pattern and the underlying mechanic.
4. Language: Explanations, meanings, and mental steps must be in natural Vietnamese.

OUTPUT ONLY RAW JSON MATCHING THIS SCHEMA:
{
  "sentence": "string",
  "complexity": "micro" | "simple" | "compound" | "complex",
  "translationVi": "string (natural Vietnamese)",
  "coreIdeaVi": "string (1 concise sentence)",
  "skeleton": {
    "pattern": "e.g. S + V + O + A",
    "parts": [{ "type": "S" | "V" | "O" | "C" | "A", "text": "string" }]
  },
  "chunks": [{ "chunkText": "string", "meaningVi": "string", "type": "noun_phrase" | "verb_phrase" | "prepositional_phrase" | "clause" }],
  "clauses": [{ "clauseText": "string", "role": "string", "subject": "string", "verb": "string", "objectOrComplement": "string" }],
  "vocabulary": [{
    "term": "string",
    "ipa": "string",
    "partOfSpeech": "string",
    "contextMeaningVi": "string",
    "cefr": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
    "isTechnicalTerm": boolean,
    "wordFamily": [{ "word": "string", "partOfSpeech": "string" }]
  }],
  "idiomsAndPhrases": [{ "phrase": "string", "meaningVi": "string" }],
  "grammar": {
    "pattern": "string",
    "explanation": "string",
    "ruleSummary": "string",
    "whyUsedVi": "string",
    "mechanicVi": "string"
  },
  "mentalModelSteps": ["string (2-4 left-to-right reading steps)"]
}
No markdown backticks, no explanations outside JSON.`;

      const userContent = `Paragraph context: """${contextParagraph}"""\n\nSentence to analyze: """${sentence}"""`;

      const requestBody: Record<string, unknown> = {
        model: config.model,
        temperature: config.temperature ?? 0.1,
        stream: false,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      };

      let res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(30000), // Timeout 30s
      });

      // Nếu proxy/endpoint trả về lỗi 400 (ví dụ 9Router hoặc Gemini không hỗ trợ response_format), thử lại không kèm response_format
      if (!res.ok && res.status === 400 && requestBody.response_format) {
        const retryBody = { ...requestBody };
        delete retryBody.response_format;
        res = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(retryBody),
          signal: AbortSignal.timeout(30000),
        });
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
            // ignore chunk
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

      let cleanJson = rawContent
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      const firstBrace = cleanJson.indexOf("{");
      const lastBrace = cleanJson.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanJson = cleanJson.slice(firstBrace, lastBrace + 1);
      }

      let parsed: SentenceBreakdownResponse;
      try {
        parsed = JSON.parse(cleanJson);
      } catch {
        throw new Error(`AI không trả về JSON hợp lệ: ${cleanJson.slice(0, 150)}...`);
      }

      if (!parsed.sentence) parsed.sentence = sentence;
      if (!parsed.translationVi) parsed.translationVi = "";
      if (!parsed.coreIdeaVi) parsed.coreIdeaVi = "";
      if (!parsed.complexity) parsed.complexity = "simple";
      if (!parsed.simplifiedEnglish) parsed.simplifiedEnglish = "";

      // Skeleton fallback & tự động bù đắp roleVi cho từng part nếu thiếu
      if (!parsed.skeleton || typeof parsed.skeleton !== "object") {
        parsed.skeleton = { pattern: "S + V + O", parts: [] };
      } else {
        if (!parsed.skeleton.pattern) parsed.skeleton.pattern = "S + V";
        if (!Array.isArray(parsed.skeleton.parts)) {
          parsed.skeleton.parts = [];
        } else {
          parsed.skeleton.parts = parsed.skeleton.parts.map((p) => {
            const rawType = (p.type || "S").toUpperCase() as "S" | "V" | "O" | "C" | "A";
            const validTypes: Array<"S" | "V" | "O" | "C" | "A"> = ["S", "V", "O", "C", "A"];
            const type = validTypes.includes(rawType) ? rawType : "S";
            return {
              type,
              text: p.text || "",
              roleVi: p.roleVi || ROLE_MAP[type] || "Thành phần câu",
            };
          });
        }
      }

      // Semantic chunks fallback
      if (!Array.isArray(parsed.chunks)) {
        parsed.chunks = [];
      } else {
        parsed.chunks = parsed.chunks.map((c) => ({
          chunkText: c.chunkText || "",
          meaningVi: c.meaningVi || "",
          type: c.type || "noun_phrase",
        }));
      }

      // Grammar fallback
      if (!parsed.grammar || typeof parsed.grammar !== "object") {
        parsed.grammar = {
          pattern: "Standard Structure",
          explanation: "Cấu trúc câu tiêu chuẩn",
          ruleSummary: "",
          whyUsedVi: "",
          mechanicVi: "",
          clauses: [],
        };
      }
      if (!parsed.grammar.pattern) parsed.grammar.pattern = "Standard Structure";
      if (!parsed.grammar.explanation) parsed.grammar.explanation = "Cấu trúc câu tiêu chuẩn";
      if (!parsed.grammar.whyUsedVi) parsed.grammar.whyUsedVi = "";
      if (!parsed.grammar.mechanicVi) parsed.grammar.mechanicVi = "";
      if (!parsed.grammar.ruleSummary) parsed.grammar.ruleSummary = "";

      // Tự động ánh xạ clauses: Nếu LLM trả về parsed.clauses ở root level hoặc parsed.grammar.clauses, đảm bảo gán đúng vào parsed.grammar.clauses
      const rootClauses = parsed.clauses;
      const rawClauses =
        Array.isArray(rootClauses) && rootClauses.length > 0
          ? rootClauses
          : Array.isArray(parsed.grammar.clauses)
            ? parsed.grammar.clauses
            : [];

      parsed.grammar.clauses = rawClauses.map((c) => ({
        clauseText: c.clauseText || "",
        role: c.role || "Main Clause",
        subject: c.subject || "",
        verb: c.verb || "",
        objectOrComplement: c.objectOrComplement || "",
      }));
      parsed.clauses = parsed.grammar.clauses;

      // Vocabulary fallback (preserve full array, safe fallback for items)
      if (!Array.isArray(parsed.vocabulary)) {
        parsed.vocabulary = [];
      } else {
        parsed.vocabulary = parsed.vocabulary.map((v) => ({
          ...v,
          term: v.term || "",
          ipa: v.ipa || "",
          partOfSpeech: v.partOfSpeech || "",
          contextMeaningVi: v.contextMeaningVi || "",
          isTechnicalTerm: Boolean(v.isTechnicalTerm),
          wordFamily: Array.isArray(v.wordFamily)
            ? v.wordFamily.map((wf) => ({
                word: wf.word || "",
                partOfSpeech: wf.partOfSpeech || "",
              }))
            : [],
        }));
      }

      // Idioms fallback
      if (!Array.isArray(parsed.idiomsAndPhrases)) parsed.idiomsAndPhrases = [];

      // Mental model steps fallback
      if (!Array.isArray(parsed.mentalModelSteps)) {
        parsed.mentalModelSteps = [];
      } else {
        parsed.mentalModelSteps = parsed.mentalModelSteps
          .map((s) => (typeof s === "string" ? s.trim() : ""))
          .filter(Boolean);
      }

      // Lưu vào cache L1 & L2
      setCachedAnalysis(sentence, parsed);

      return parsed;
    } finally {
      inFlightAnalysis.delete(hash);
    }
  })();

  inFlightAnalysis.set(hash, fetchPromise);
  return fetchPromise;
}
