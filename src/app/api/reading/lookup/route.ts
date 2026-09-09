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

  // 1. Kiểm tra Server In-Memory Cache (chỉ chấp nhận nếu có bản dịch hoặc định nghĩa)
  if (serverDictCache.has(word)) {
    const cachedData = serverDictCache.get(word)!;
    if (cachedData.translationVi || cachedData.definition) {
      return NextResponse.json(cachedData, { headers: CACHE_HEADERS });
    }
  }

  let phonetic = "";
  let definition = "";
  let translationVi = "";
  let synonyms: string[] = [];

  try {
    // 2. Nếu là cụm từ (phrase): dịch qua Google Translate
    if (isPhrase) {
      const trans = await googleTranslate(word, "en", "vi");
      if (trans) {
        translationVi = trans;
      }
    } else {
      // 3. Nếu là từ đơn: gọi song song Google Translate và dictionaryapi.dev (timeout tối đa 350ms)
      const dictPromise: Promise<DictionaryEntry[] | null> = fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
        {
          signal: AbortSignal.timeout(350),
          headers: { "User-Agent": "Mozilla/5.0 Vocabloom/1.0" },
        }
      )
        .then(async (r): Promise<DictionaryEntry[] | null> => {
          if (r.ok) {
            return (await r.json()) as DictionaryEntry[];
          }
          return null;
        })
        .catch(() => null);

      // Cập nhật ngầm vào server cache khi dictPromise hoàn tất
      dictPromise
        .then((res) => {
          if (res && res.length > 0) {
            const entry = res[0];
            const p =
              entry.phonetic ||
              entry.phonetics?.find((item) => Boolean(item.text))?.text ||
              "";
            const firstMeaning = entry.meanings?.[0];
            const d = firstMeaning?.definitions?.[0]?.definition || "";
            const s = firstMeaning?.synonyms?.slice(0, 3) || [];

            const existing = serverDictCache.get(word);
            if (existing) {
              if (!existing.phonetic && p) existing.phonetic = p;
              if (!existing.definition && d) existing.definition = d;
              if (
                (!existing.synonyms || existing.synonyms.length === 0) &&
                s.length > 0
              ) {
                existing.synonyms = s;
              }
            }
          }
        })
        .catch(() => {});

      const transPromise = googleTranslate(word, "en", "vi");

      // Chờ Google Translate trước (thường ~80-120ms)
      const transRes = await transPromise;
      if (transRes) {
        translationVi = transRes;
      }

      // Đua với dictPromise: nếu đã có translationVi, chỉ lấy dict nếu đã xong (không đợi thêm)
      // Nếu chưa có translationVi, chờ dictPromise tối đa 350ms để lấy định nghĩa/phiên âm
      const dictResult = await Promise.race([
        dictPromise,
        new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), translationVi ? 0 : 350)
        ),
      ]);

      if (dictResult && dictResult.length > 0) {
        const entry = dictResult[0];
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

    // Chỉ lưu vào server cache nếu có ít nhất bản dịch hoặc định nghĩa hợp lệ
    if (payload.translationVi || payload.definition) {
      if (serverDictCache.size >= SERVER_CACHE_MAX) {
        const firstKey = serverDictCache.keys().next().value;
        if (firstKey) serverDictCache.delete(firstKey);
      }
      serverDictCache.set(word, payload);
    }

    return NextResponse.json(payload, { headers: CACHE_HEADERS });
  } catch {
    const fallback: LookupPayload = {
      word,
      phonetic: "",
      definition: "",
      translationVi: translationVi || "",
      isPhrase,
      synonyms: [],
    };
    return NextResponse.json(fallback, { headers: CACHE_HEADERS });
  }
}
