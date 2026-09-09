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
        "User-Agent": "Mozilla/5.0 Vocabloom/1.0",
      },
      signal: AbortSignal.timeout(3500),
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

  // 1. Kiểm tra Server In-Memory Cache - chỉ coi là cache hit hợp lệ khi có translationVi hoặc definition
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
    if (isPhrase) {
      // 2. Nếu là cụm từ (phrase): dịch qua Google Translate
      const trans = await googleTranslate(word, "en", "vi");
      if (trans) {
        translationVi = trans;
      }
    } else {
      // 3. Nếu là từ đơn: gọi song song Google Translate và dictionaryapi.dev (tối đa 350ms)
      const dictState: { settled: boolean; result: DictionaryEntry[] | null } = {
        settled: false,
        result: null,
      };

      const dictPromise = fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
        {
          signal: AbortSignal.timeout(350),
          headers: { "User-Agent": "Mozilla/5.0 Vocabloom/1.0" },
        }
      )
        .then(async (r) => {
          if (r.ok) {
            return (await r.json()) as DictionaryEntry[];
          }
          return null;
        })
        .catch(() => null)
        .then((res) => {
          dictState.settled = true;
          dictState.result = res;
          return res;
        });

      const transPromise = googleTranslate(word, "en", "vi");

      // Chờ Google Translate hoàn thành
      const trans = await transPromise;
      if (trans) {
        translationVi = trans;
      }

      // Xử lý race / timeout:
      // Nếu dictionaryapi đã xong trước hoặc cùng lúc với Google Translate -> lấy đầy đủ thông tin
      if (dictState.settled && dictState.result && dictState.result.length > 0) {
        const entry = dictState.result[0];
        phonetic =
          entry.phonetic ||
          entry.phonetics?.find((p) => Boolean(p.text))?.text ||
          "";
        const firstMeaning = entry.meanings?.[0];
        definition = firstMeaning?.definitions?.[0]?.definition || "";
        synonyms = firstMeaning?.synonyms?.slice(0, 3) || [];
      } else if (!translationVi) {
        // Nếu Google Translate không ra kết quả, đợi dictionaryapi tối đa đến hết 350ms
        const res = await dictPromise;
        if (res && res.length > 0) {
          const entry = res[0];
          phonetic =
            entry.phonetic ||
            entry.phonetics?.find((p) => Boolean(p.text))?.text ||
            "";
          const firstMeaning = entry.meanings?.[0];
          definition = firstMeaning?.definitions?.[0]?.definition || "";
          synonyms = firstMeaning?.synonyms?.slice(0, 3) || [];
        }
      } else {
        // Đã có translationVi từ Google Translate:
        // Trả ngay bản dịch tiếng Việt về client với headers Cache-Control chuẩn (không chờ dictionaryapi).
        // Cập nhật bổ sung phonetic/definition vào server cache khi dictionaryapi hoàn thành ngầm.
        dictPromise
          .then((res) => {
            if (res && Array.isArray(res) && res.length > 0) {
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
                if ((!existing.synonyms || existing.synonyms.length === 0) && s.length > 0) {
                  existing.synonyms = s;
                }
              }
            }
          })
          .catch(() => {});
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

    // Chỉ cache nếu có ít nhất translationVi hoặc definition
    if (translationVi || definition) {
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
      phonetic,
      definition,
      translationVi,
      isPhrase,
      synonyms,
    };
    return NextResponse.json(fallback, { headers: CACHE_HEADERS });
  }
}
