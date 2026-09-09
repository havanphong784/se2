import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface BatchLookupRequest {
  words: string[];
}

interface BatchItemResult {
  word: string;
  translationVi: string;
}

const SERVER_BATCH_CACHE = new Map<string, string>();
const MAX_BATCH_CACHE = 10000;

async function batchGoogleTranslate(
  words: string[]
): Promise<Record<string, string>> {
  if (words.length === 0) return {};

  const cleanWords = words.map((w) => w.trim()).filter(Boolean);
  if (cleanWords.length === 0) return {};

  const result: Record<string, string> = {};
  const CHUNK_SIZE = 20;

  for (let i = 0; i < cleanWords.length; i += CHUNK_SIZE) {
    const chunk = cleanWords.slice(i, i + CHUNK_SIZE);
    const text = chunk.join("\n");

    try {
      const url = new URL("https://translate.googleapis.com/translate_a/single");
      url.searchParams.set("client", "gtx");
      url.searchParams.set("sl", "en");
      url.searchParams.set("tl", "vi");
      url.searchParams.set("dt", "t");
      url.searchParams.set("q", text);

      const res = await fetch(url.toString(), {
        headers: { "User-Agent": "Mozilla/5.0 Vocabloom/1.0" },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) continue;

      const data = (await res.json()) as Array<Array<Array<string>>>;
      if (!Array.isArray(data) || !Array.isArray(data[0])) continue;

      const rawTranslated = data[0]
        .filter((part) => Array.isArray(part) && typeof part[0] === "string")
        .map((part) => part[0])
        .join("");

      const translatedLines = rawTranslated.split("\n").map((s) => s.trim());

      chunk.forEach((w, idx) => {
        const trans = translatedLines[idx] || "";
        const lower = w.toLowerCase();
        result[lower] = trans;
        if (SERVER_BATCH_CACHE.size >= MAX_BATCH_CACHE) {
          const firstKey = SERVER_BATCH_CACHE.keys().next().value;
          if (firstKey) SERVER_BATCH_CACHE.delete(firstKey);
        }
        if (trans) {
          SERVER_BATCH_CACHE.set(lower, trans);
        }
      });
    } catch {
      // Bỏ qua lỗi từng batch nhỏ
    }
  }

  return result;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as BatchLookupRequest | null;
    if (!body || !Array.isArray(body.words) || body.words.length === 0) {
      return NextResponse.json({ results: {} });
    }

    const uniqueWords = Array.from(
      new Set(
        body.words
          .map((w) => (typeof w === "string" ? w.trim().toLowerCase() : ""))
          .filter((w) => w.length >= 2)
      )
    ).slice(0, 60); // Giới hạn tối đa 60 từ/cụm từ một lần

    const results: Record<string, BatchItemResult> = {};
    const wordsToFetch: string[] = [];

    for (const word of uniqueWords) {
      if (SERVER_BATCH_CACHE.has(word)) {
        results[word] = {
          word,
          translationVi: SERVER_BATCH_CACHE.get(word)!,
        };
      } else {
        wordsToFetch.push(word);
      }
    }

    if (wordsToFetch.length > 0) {
      const fetchedTranslations = await batchGoogleTranslate(wordsToFetch);
      for (const word of wordsToFetch) {
        const trans = fetchedTranslations[word] || "";
        results[word] = {
          word,
          translationVi: trans,
        };
      }
    }

    return NextResponse.json(
      { results },
      {
        headers: {
          "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
        },
      }
    );
  } catch {
    return NextResponse.json({ results: {} });
  }
}
