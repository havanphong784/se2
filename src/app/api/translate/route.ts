import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";

type TranslateRequest = {
  text?: unknown;
  direction?: unknown;
};

type DictionaryEntry = {
  phonetic?: string;
  phonetics?: Array<{ text?: string; audio?: string }>;
  meanings?: Array<{
    partOfSpeech?: string;
    definitions?: Array<{ definition?: string; example?: string }>;
  }>;
};

const posMapEnToVi: Record<string, string> = {
  noun: "danh từ",
  verb: "động từ",
  adjective: "tính từ",
  adverb: "phó từ",
  pronoun: "đại từ",
  preposition: "giới từ",
  conjunction: "liên từ",
  interjection: "thán từ",
  article: "mạo từ",
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
      signal: AbortSignal.timeout(8000),
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

async function fetchEnglishDictionaryDetails(word: string) {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as DictionaryEntry[];
    if (!Array.isArray(data) || !data.length) return null;

    const entry = data[0];
    let phonetic = entry.phonetic || "";
    if (!phonetic && entry.phonetics?.length) {
      const pWithText = entry.phonetics.find((p) => p.text);
      if (pWithText) phonetic = pWithText.text || "";
    }

    const partsOfSpeechSet = new Set<string>();
    const examples: string[] = [];

    if (entry.meanings?.length) {
      for (const m of entry.meanings) {
        if (m.partOfSpeech) {
          const posVi = posMapEnToVi[m.partOfSpeech.toLowerCase()] || m.partOfSpeech;
          partsOfSpeechSet.add(posVi);
        }
        if (m.definitions?.length) {
          for (const d of m.definitions) {
            if (d.example && examples.length < 2) {
              examples.push(d.example);
            }
          }
        }
      }
    }

    return {
      phonetic,
      partsOfSpeech: Array.from(partsOfSpeechSet),
      exampleSentence: examples[0] || "",
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "Cơ sở dữ liệu chưa sẵn sàng." }, { status: 503 });
  if (!(await requireAuth(request, db))) {
    return NextResponse.json({ error: "Chưa xác thực." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as TranslateRequest | null;
  if (
    !body ||
    typeof body.text !== "string" ||
    !body.text.trim() ||
    (body.direction !== "en-vi" && body.direction !== "vi-en")
  ) {
    return NextResponse.json(
      { error: "Thiếu hoặc sai tham số text/direction (en-vi hoặc vi-en)." },
      { status: 400 },
    );
  }

  const text = body.text.trim().slice(0, 2000);
  const sourceLang = body.direction === "en-vi" ? "en" : "vi";
  const targetLang = body.direction === "en-vi" ? "vi" : "en";

  try {
    const translatedText = await googleTranslate(text, sourceLang, targetLang);

    if (!translatedText) {
      return NextResponse.json(
        { error: "Dịch vụ dịch tạm thời lỗi." },
        { status: 502 },
      );
    }

    const isSingleWord = !text.includes(" ") && text.length <= 40;
    const englishWord =
      body.direction === "en-vi"
        ? isSingleWord
          ? text
          : ""
        : !translatedText.includes(" ")
          ? translatedText
          : "";

    let dictDetails: {
      phonetic: string;
      partsOfSpeech: string[];
      exampleSentence: string;
    } | null = null;

    let exampleTranslation = "";

    if (englishWord) {
      dictDetails = await fetchEnglishDictionaryDetails(englishWord);
      if (dictDetails?.exampleSentence) {
        exampleTranslation =
          (await googleTranslate(dictDetails.exampleSentence, "en", "vi")) || "";
      }
    }

    return NextResponse.json({
      original: text,
      translated: translatedText,
      direction: body.direction,
      confidence: 1.0,
      phonetic: dictDetails?.phonetic || "",
      partsOfSpeech: dictDetails?.partsOfSpeech || [],
      exampleSentence: dictDetails?.exampleSentence || "",
      exampleTranslation,
    });
  } catch {
    return NextResponse.json(
      { error: "Không thể kết nối dịch vụ dịch." },
      { status: 503 },
    );
  }
}
