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
  translationVi: string;
  isPhrase: boolean;
  synonyms: string[];
}

// Server-side in-memory cache cho 5000 từ/cụm từ phổ biến nhất
const SERVER_CACHE_MAX = 5000;
const serverDictCache = new Map<string, LookupPayload>();

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
};

async function googleTranslate(text: string, sourceLang: string, targetLang: string): Promise<string | null> {
  try {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", sourceLang);
    url.searchParams.set("tl", targetLang);
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", text);

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as Array<Array<Array<string>>>;
    if (!Array.isArray(data) || !Array.isArray(data[0])) return null;

    const translatedParts = data[0]
      .filter((part) => Array.isArray(part) && typeof part[0] === "string")
      .map((part) => part[0]);

    return translatedParts.join("").trim() || null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawWord = searchParams.get("word");

  if (!rawWord || !rawWord.trim()) {
    return NextResponse.json({ error: "Thiếu tham số word." }, { status: 400 });
  }

  const word = rawWord.trim().toLowerCase();
  const isPhrase = word.includes(" ") || word.includes("-");

  // 1. Kiểm tra Server In-Memory Cache
  if (serverDictCache.has(word)) {
    const cachedData = serverDictCache.get(word)!;
    return NextResponse.json(cachedData, { headers: CACHE_HEADERS });
  }

  let phonetic = "";
  let definition = "";
  let translationVi = "";
  let synonyms: string[] = [];

  try {
    // 2. Nếu là cụm từ (phrase): dịch qua Google Translate
    if (isPhrase) {
      const trans = await googleTranslate(word, "en", "vi");
      translationVi = trans || "";
    } else {
      // 3. Nếu là từ đơn: gọi song song từ điển Anh-Anh và Google Translate
      const [dictRes, transRes] = await Promise.allSettled([
        fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
          signal: AbortSignal.timeout(3000),
          headers: { "User-Agent": "Mozilla/5.0 Vocabloom/1.0" },
        }).then((r) => (r.ok ? (r.json() as Promise<DictionaryEntry[]>) : null)),
        googleTranslate(word, "en", "vi"),
      ]);

      if (transRes.status === "fulfilled" && transRes.value) {
        translationVi = transRes.value;
      }

      if (dictRes.status === "fulfilled" && Array.isArray(dictRes.value) && dictRes.value.length > 0) {
        const entry = dictRes.value[0];
        phonetic =
          entry.phonetic ||
          entry.phonetics?.find((p) => Boolean(p.text))?.text ||
          "";

        const firstMeaning = entry.meanings?.[0];
        definition = firstMeaning?.definitions?.[0]?.definition || "";
        synonyms = firstMeaning?.synonyms?.slice(0, 3) || [];
      }
    }

    const payload: LookupPayload = {
      word,
      phonetic,
      definition,
      translationVi,
      isPhrase,
      synonyms,
    };

    // Lưu cache
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
      translationVi: "",
      isPhrase,
      synonyms: [],
    };
    return NextResponse.json(fallback, { headers: CACHE_HEADERS });
  }
}
