import type { ClientAIConfig, SentenceBreakdownResponse } from "@/types/reading";

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

      // System Prompt 7 tầng sư phạm sâu sắc
      const systemPrompt = `You are an expert English linguist and teacher for Vocabloom language platform.
Analyze the target English sentence within the given paragraph context using a comprehensive 7-layer pedagogical framework:
Layer 1: Contextual Translation & Core Idea (translationVi, coreIdeaVi)
Layer 2: Sentence Skeleton S-V-O-A (skeleton: pattern, parts)
Layer 3: Clause Breakdown (grammar.clauses)
Layer 4: Natural Semantic Chunking Flow (chunks)
Layer 5: Key Contextual Vocabulary & Word Family (vocabulary)
Layer 6: Grammar Structure & Pedagogical "Why" (grammar: pattern, explanation, ruleSummary, whyUsedVi, mechanicVi)
Layer 7: Natural Mental Model Steps (mentalModelSteps)

PEDAGOGICAL RULES & INSTRUCTIONS:
1. Adaptive Depth:
   - Identify "complexity": "micro" | "simple" | "compound" | "complex".
   - For "micro" sentences (short imperative commands, greetings, exclamations, e.g. "Click here.", "Thank you."): keep breakdown concise and light, do not force artificial complexity.
2. Preserve IT / Technical Terms:
   - Do NOT translate established technical/IT terms literally (e.g., API, database, cache, token, request, backend, frontend, framework, middleware, thread). Mark "isTechnicalTerm": true for these items.
3. Skeleton S-V-O-A (Layer 2):
   - Provide summary pattern: e.g. "S + V + O", "S + V + C", "S + V + O + A".
   - Break sentence into core structural parts:
     - type: "S" (Subject) | "V" (Verb) | "O" (Object) | "C" (Complement) | "A" (Adverbial)
     - text: corresponding text in the sentence
     - roleVi: "Chủ ngữ" | "Động từ" | "Tân ngữ" | "Bổ ngữ" | "Trạng ngữ"
4. Semantic Chunking Flow (Layer 4):
   - Divide the sentence into natural meaningful chunks in reading order (Noun phrase, Verb phrase, Prepositional phrase, Adverbial phrase, Clause).
   - Each chunk has: "chunkText" (English chunk), "meaningVi" (natural Vietnamese meaning), "type" ("noun_phrase" | "verb_phrase" | "prepositional_phrase" | "adverbial_phrase" | "clause").
5. Key Vocabulary & Word Family (Layer 5):
   - PRESERVE FULL VOCABULARY ARRAY: Do NOT truncate vocabulary, extract all key words/phrases necessary for learner comprehension.
   - For key terms, include "wordFamily" with 1-3 related words of different parts of speech (e.g. {"word": "analyze", "partOfSpeech": "verb"}).
   - Provide realistic CEFR level ("A1" | "A2" | "B1" | "B2" | "C1" | "C2").
6. The "Why" & Mechanics (Layer 6):
   - "whyUsedVi": Clearly explain WHY the author chose this grammatical structure/tense in this context (what rhetorical effect, focus, or tone it creates).
   - "mechanicVi": Explain the grammar mechanic (verb agreement, tense reason, participle reduction, passive shift).
7. Mental Model Steps (Layer 7):
   - 2-4 sequential steps explaining how a native reader digests this sentence from left to right, helping Vietnamese learners avoid translating backwards.

OUTPUT STRICTLY A VALID JSON OBJECT WITH THIS EXACT FORMAT:
{
  "sentence": "the original sentence",
  "complexity": "simple | compound | complex | micro",
  "translationVi": "accurate, natural Vietnamese translation fitting the context",
  "coreIdeaVi": "concise 1-sentence summary of the core message in Vietnamese",
  "skeleton": {
    "pattern": "e.g. S + V + O + A",
    "parts": [
      {
        "type": "S",
        "text": "The engineering team",
        "roleVi": "Chủ ngữ"
      },
      {
        "type": "V",
        "text": "has deployed",
        "roleVi": "Động từ"
      },
      {
        "type": "O",
        "text": "the critical security patch",
        "roleVi": "Tân ngữ"
      },
      {
        "type": "A",
        "text": "to production servers",
        "roleVi": "Trạng ngữ"
      }
    ]
  },
  "chunks": [
    {
      "chunkText": "The engineering team",
      "meaningVi": "Đội ngũ kỹ thuật",
      "type": "noun_phrase"
    },
    {
      "chunkText": "has deployed",
      "meaningVi": "đã triển khai",
      "type": "verb_phrase"
    },
    {
      "chunkText": "the critical security patch",
      "meaningVi": "bản vá bảo mật quan trọng",
      "type": "noun_phrase"
    },
    {
      "chunkText": "to production servers",
      "meaningVi": "lên các máy chủ production",
      "type": "prepositional_phrase"
    }
  ],
  "grammar": {
    "pattern": "Present Perfect Tense with Prepositional Modifier",
    "explanation": "Câu diễn tả một hành động vừa hoàn tất trong quá khứ nhưng để lại kết quả trực tiếp ở hiện tại.",
    "ruleSummary": "S + have/has + V3/ed + O + Prepositional Phrase",
    "whyUsedVi": "Tác giả dùng thì Hiện tại hoàn thành để nhấn mạnh trạng thái hiện tại của hệ thống sau khi được vá lỗi.",
    "mechanicVi": "Chủ ngữ số ít 'team' (danh từ tập hợp) đi với 'has deployed', giới từ 'to' chỉ hướng đích.",
    "clauses": [
      {
        "clauseText": "The engineering team has deployed the critical security patch to production servers",
        "role": "Main Clause",
        "subject": "The engineering team",
        "verb": "has deployed",
        "objectOrComplement": "the critical security patch"
      }
    ]
  },
  "vocabulary": [
    {
      "term": "deployed",
      "ipa": "/dɪˈplɔɪd/",
      "partOfSpeech": "verb",
      "contextMeaningVi": "triển khai, đưa vào hoạt động",
      "cefr": "B2",
      "isTechnicalTerm": true,
      "wordFamily": [
        { "word": "deployment", "partOfSpeech": "noun" },
        { "word": "deployable", "partOfSpeech": "adjective" }
      ]
    }
  ],
  "idiomsAndPhrases": [
    {
      "phrase": "production servers",
      "meaningVi": "máy chủ môi trường thực tế (production)"
    }
  ],
  "mentalModelSteps": [
    "1. Nắm bắt chủ thể thực hiện: 'The engineering team' (đội ngũ kỹ thuật).",
    "2. Tiếp nhận hành động hoàn tất: 'has deployed' (vừa hoàn tất triển khai).",
    "3. Nắm đối tượng tác động: 'the critical security patch' (bản vá bảo mật trọng yếu).",
    "4. Tiếp nhận đích đến: 'to production servers' (lên hệ thống thực tế)."
  ]
}
Be concise, educational, and precise. Output valid raw JSON only. No markdown backticks, no conversational wrapper.`;

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

      // Skeleton fallback
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
            const defaultRoles: Record<string, string> = {
              S: "Chủ ngữ",
              V: "Động từ",
              O: "Tân ngữ",
              C: "Bổ ngữ",
              A: "Trạng ngữ",
            };
            return {
              type,
              text: p.text || "",
              roleVi: p.roleVi || defaultRoles[type] || "Thành phần câu",
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
      if (!Array.isArray(parsed.grammar.clauses)) parsed.grammar.clauses = [];
      if (!parsed.grammar.whyUsedVi) parsed.grammar.whyUsedVi = "";
      if (!parsed.grammar.mechanicVi) parsed.grammar.mechanicVi = "";
      if (!parsed.grammar.ruleSummary) parsed.grammar.ruleSummary = "";

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
