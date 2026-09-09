import type { ClientAIConfig, SentenceBreakdownResponse } from "@/types/reading";

export const DEFAULT_AI_CONFIG: ClientAIConfig = {
  provider: "local_tunnel",
  baseUrl: "http://localhost:11434/v1",
  model: "qwen2.5:7b",
  temperature: 0.1,
  autoAnalyzeOnClick: true,
};

export const LOCAL_STORAGE_AI_KEY = "vocabloom_ai_config";
export const LOCAL_STORAGE_CACHE_PREFIX = "vocabloom_analysis_cache_";

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
 * Lấy kết quả phân tích đã lưu trong cache
 */
export function getCachedAnalysis(sentence: string): SentenceBreakdownResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const key = LOCAL_STORAGE_CACHE_PREFIX + getSentenceHash(sentence);
    const item = localStorage.getItem(key);
    if (!item) return null;
    return JSON.parse(item) as SentenceBreakdownResponse;
  } catch {
    return null;
  }
}

/**
 * Lưu kết quả phân tích vào cache
 */
export function setCachedAnalysis(sentence: string, analysis: SentenceBreakdownResponse): void {
  if (typeof window === "undefined") return;
  try {
    const key = LOCAL_STORAGE_CACHE_PREFIX + getSentenceHash(sentence);
    localStorage.setItem(key, JSON.stringify(analysis));
  } catch (e) {
    console.warn("Storage full or unable to cache analysis", e);
  }
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

    // Nếu /models không hỗ trợ (một số tunnel chỉ mở /chat/completions), thử gửi test OPTIONS hoặc báo trạng thái HTTP
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
 * Gọi AI phân tích bóc tách câu chuyên sâu
 */
export async function analyzeSentence(
  sentence: string,
  contextParagraph: string,
  config: ClientAIConfig
): Promise<SentenceBreakdownResponse> {
  // 1. Kiểm tra cache trước
  const cached = getCachedAnalysis(sentence);
  if (cached) {
    return cached;
  }

  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const systemPrompt = `You are an expert English linguist and teacher for Vocabloom language platform.
Analyze the target English sentence within the given paragraph context.
You MUST output strictly a JSON object with this exact structure:
{
  "sentence": "the original sentence",
  "translationVi": "accurate Vietnamese natural translation in context",
  "simplifiedEnglish": "a simplified rewritten version (A2-B1 level) expressing the same meaning",
  "grammar": {
    "pattern": "name of key grammar pattern (e.g. Inversion, Relative Clause, Passive Voice, Conditional)",
    "explanation": "clear and educational explanation of why this structure was used and how it functions",
    "clauses": [
      {
        "clauseText": "part of the sentence",
        "role": "Main Clause | Subordinate Clause | Relative Clause | Adverbial Clause",
        "subject": "subject of clause",
        "verb": "verb phrase of clause",
        "objectOrComplement": "object or complement if any"
      }
    ]
  },
  "vocabulary": [
    {
      "term": "word from sentence",
      "ipa": "/phonetic/",
      "partOfSpeech": "noun | verb | adjective | adverb | etc.",
      "contextMeaningVi": "meaning of the word specifically in this sentence context",
      "cefr": "B1 | B2 | C1 | C2"
    }
  ],
  "idiomsAndPhrases": [
    {
      "phrase": "collocation or idiom",
      "meaningVi": "Vietnamese explanation"
    }
  ]
}
Return only raw JSON. No markdown backticks, no introduction, no conversational wrapper.`;

  const userContent = `Paragraph context: """${contextParagraph}"""\n\nSentence to analyze: """${sentence}"""`;

  const requestBody: Record<string, unknown> = {
    model: config.model,
    temperature: config.temperature ?? 0.1,
    stream: false,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  };

  // Hỗ trợ JSON response format cho Ollama, vLLM, OpenAI
  requestBody.response_format = { type: "json_object" };

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(30000), // Timeout 30s cho model local
  });

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

  // Xử lý cả phản hồi Server-Sent Events (SSE: data: {...}) lẫn JSON chuẩn
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

  // Làm sạch các markdown tag ```json nếu có
  let cleanJson = rawContent
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Trích xuất JSON object nằm giữa { và } để tránh chữ dẫn giải ngoài lề
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

  // Đảm bảo các field bắt buộc có fallback hợp lý
  if (!parsed.sentence) parsed.sentence = sentence;
  if (!parsed.grammar) parsed.grammar = { pattern: "Standard Structure", explanation: "Cấu trúc cơ bản", clauses: [] };
  if (!Array.isArray(parsed.grammar.clauses)) parsed.grammar.clauses = [];
  if (!Array.isArray(parsed.vocabulary)) parsed.vocabulary = [];
  if (!Array.isArray(parsed.idiomsAndPhrases)) parsed.idiomsAndPhrases = [];

  // Lưu vào cache
  setCachedAnalysis(sentence, parsed);

  return parsed;
}
