import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { requireAuth } from "@/lib/auth";
import { fetchFreeDictionaryWord } from "@/lib/dictionary-api";

export const runtime = "nodejs";

async function googleTranslate(text: string, sourceLang: string, targetLang: string): Promise<string> {
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

    if (!response.ok) return "";

    const data = (await response.json()) as Array<Array<Array<string>>>;
    if (!Array.isArray(data) || !Array.isArray(data[0])) return "";

    const translatedParts = data[0]
      .filter((part) => Array.isArray(part) && typeof part[0] === "string")
      .map((part) => part[0]);

    return translatedParts.join("").trim();
  } catch {
    return "";
  }
}

export async function GET(request: Request) {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: { message: "Cơ sở dữ liệu chưa sẵn sàng." } }, { status: 503 });
  }
  const user = await requireAuth(request, db);
  if (!user) {
    return NextResponse.json({ error: { message: "Chưa xác thực." } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawWord = searchParams.get("word");

  if (!rawWord || !rawWord.trim()) {
    return NextResponse.json(
      { error: { message: "Thiếu từ cần tra cứu." } },
      { status: 400 },
    );
  }

  const word = rawWord.trim();
  const dictData = await fetchFreeDictionaryWord(word);

  // Dịch từ tiếng Anh sang tiếng Việt
  const wordTranslationPromise = googleTranslate(word, "en", "vi");

  // Dịch câu ví dụ nếu có
  const exampleTranslationPromise =
    dictData?.exampleSentence
      ? googleTranslate(dictData.exampleSentence, "en", "vi")
      : Promise.resolve("");

  // Dịch định nghĩa nếu có
  const definitionTranslationPromise =
    dictData?.definition
      ? googleTranslate(dictData.definition, "en", "vi")
      : Promise.resolve("");

  const [translationVi, exampleTranslationVi, definitionTranslationVi] = await Promise.all([
    wordTranslationPromise,
    exampleTranslationPromise,
    definitionTranslationPromise,
  ]);

  if (!dictData) {
    // Không tìm thấy trong Free Dictionary nhưng có thể có Google Translate
    return NextResponse.json({
      foundInDictionary: false,
      word,
      translation: translationVi || "",
      phonetic: "",
      audioUrl: null,
      partsOfSpeech: [],
      partsOfSpeechVi: [],
      definition: "",
      exampleSentence: "",
      exampleTranslation: "",
      allDefinitions: [],
    });
  }

  return NextResponse.json({
    foundInDictionary: true,
    word: dictData.word,
    translation: translationVi || definitionTranslationVi || "",
    phonetic: dictData.phonetic,
    audioUrl: dictData.audioUrl,
    partsOfSpeech: dictData.partsOfSpeech,
    partsOfSpeechVi: dictData.partsOfSpeechVi,
    definition: dictData.definition,
    definitionTranslation: definitionTranslationVi,
    exampleSentence: dictData.exampleSentence,
    exampleTranslation: exampleTranslationVi,
    allDefinitions: dictData.allDefinitions,
  });
}
