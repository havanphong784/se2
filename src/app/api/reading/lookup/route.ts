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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawWord = searchParams.get("word");

  if (!rawWord || !rawWord.trim()) {
    return NextResponse.json({ error: "Thiếu tham số word." }, { status: 400 });
  }

  const word = rawWord.trim().toLowerCase();

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      {
        signal: AbortSignal.timeout(4000),
        headers: { "User-Agent": "Mozilla/5.0 Vocabloom/1.0" },
      }
    );

    if (!res.ok) {
      return NextResponse.json({
        word,
        phonetic: "",
        definition: "",
        synonyms: [],
      });
    }

    const json = (await res.json()) as DictionaryEntry[];
    if (!Array.isArray(json) || json.length === 0) {
      return NextResponse.json({
        word,
        phonetic: "",
        definition: "",
        synonyms: [],
      });
    }

    const entry = json[0];
    const phonetic =
      entry.phonetic ||
      entry.phonetics?.find((p) => Boolean(p.text))?.text ||
      "";

    const firstMeaning = entry.meanings?.[0];
    const firstDef = firstMeaning?.definitions?.[0]?.definition || "";
    const synonyms = firstMeaning?.synonyms?.slice(0, 3) || [];

    return NextResponse.json({
      word,
      phonetic,
      definition: firstDef,
      synonyms,
    });
  } catch {
    return NextResponse.json({
      word,
      phonetic: "",
      definition: "",
      synonyms: [],
    });
  }
}
