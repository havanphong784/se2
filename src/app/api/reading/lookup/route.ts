import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface DictionaryEntry {
  phonetic?: string;
  phonetics?: Array<{ text?: string; audio?: string }>;
  meanings?: Array<{
    partOfSpeech?: string;
    definitions?: Array<{ definition?: string; example?: string }>;
    synonyms?: string[];
  }>;
}

interface LookupPayload {
  word: string;
  phonetic: string;
  definition: string;
  synonyms: string[];
}

// Server-side in-memory cache cho 5000 từ phổ biến nhất trong Node.js process
const SERVER_CACHE_MAX = 5000;
const serverDictCache = new Map<string, LookupPayload>();

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawWord = searchParams.get("word");

  if (!rawWord || !rawWord.trim()) {
    return NextResponse.json({ error: "Thiếu tham số word." }, { status: 400 });
  }

  const word = rawWord.trim().toLowerCase();

  // 1. Kiểm tra Server In-Memory Cache
  if (serverDictCache.has(word)) {
    const cachedData = serverDictCache.get(word)!;
    return NextResponse.json(cachedData, { headers: CACHE_HEADERS });
  }

  // 2. Gọi dịch vụ ngoài nếu chưa có trong cache
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      {
        signal: AbortSignal.timeout(3500),
        headers: { "User-Agent": "Mozilla/5.0 Vocabloom/1.0" },
      }
    );

    let payload: LookupPayload = {
      word,
      phonetic: "",
      definition: "",
      synonyms: [],
    };

    if (res.ok) {
      const json = (await res.json()) as DictionaryEntry[];
      if (Array.isArray(json) && json.length > 0) {
        const entry = json[0];
        const phonetic =
          entry.phonetic ||
          entry.phonetics?.find((p) => Boolean(p.text))?.text ||
          "";

        const firstMeaning = entry.meanings?.[0];
        const firstDef = firstMeaning?.definitions?.[0]?.definition || "";
        const synonyms = firstMeaning?.synonyms?.slice(0, 3) || [];

        payload = {
          word,
          phonetic,
          definition: firstDef,
          synonyms,
        };
      }
    }

    // Lưu vào Server Memory Cache (giới hạn dung lượng)
    if (serverDictCache.size >= SERVER_CACHE_MAX) {
      const firstKey = serverDictCache.keys().next().value;
      if (firstKey) serverDictCache.delete(firstKey);
    }
    serverDictCache.set(word, payload);

    return NextResponse.json(payload, { headers: CACHE_HEADERS });
  } catch {
    const fallback: LookupPayload = {
      word,
      phonetic: "",
      definition: "",
      synonyms: [],
    };
    return NextResponse.json(fallback, { headers: CACHE_HEADERS });
  }
}
