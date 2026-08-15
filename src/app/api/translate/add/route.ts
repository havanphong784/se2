import { NextResponse } from "next/server";

import { isUuid } from "@/lib/server-data";
import { importVocabulary, ImportError } from "@/lib/vocabulary-import-server";
import type { ImportedWord } from "@/lib/vocabulary-import";

export const runtime = "nodejs";

type AddWordRequest = {
  destination?:
    | { type: "existing"; deckId: string }
    | { type: "new"; title: string; description?: string; level?: string };
  word?: {
    term?: string;
    translation?: string;
    phonetic?: string;
    partOfSpeech?: string[];
    exampleSentence?: string;
    exampleTranslation?: string;
  };
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as AddWordRequest | null;
    if (!body || !body.destination || !body.word) {
      return NextResponse.json(
        { error: { message: "Thiếu thông tin gói từ hoặc từ vựng." } },
        { status: 400 },
      );
    }

    const { destination, word } = body;

    const term = typeof word.term === "string" ? word.term.normalize("NFC").trim() : "";
    const translation =
      typeof word.translation === "string" ? word.translation.normalize("NFC").trim() : "";

    if (!term || !translation) {
      return NextResponse.json(
        { error: { message: "Từ và nghĩa không được để trống." } },
        { status: 400 },
      );
    }

    if (destination.type === "existing") {
      if (!destination.deckId || !isUuid(destination.deckId)) {
        return NextResponse.json(
          { error: { message: "Gói từ được chọn không hợp lệ." } },
          { status: 400 },
        );
      }
    } else if (destination.type === "new") {
      const title =
        typeof destination.title === "string" ? destination.title.normalize("NFC").trim() : "";
      if (!title || [...title].length > 120) {
        return NextResponse.json(
          { error: { message: "Tên gói từ mới không được để trống hoặc quá 120 ký tự." } },
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json(
        { error: { message: "Loại đích đến không hợp lệ." } },
        { status: 400 },
      );
    }

    const partOfSpeech = Array.isArray(word.partOfSpeech)
      ? word.partOfSpeech.filter((p): p is string => typeof p === "string" && Boolean(p.trim()))
      : [];

    function isNoun(parts: string[]): boolean {
      return parts.some((p) => {
        const lower = p.toLowerCase();
        return lower.includes("noun") || lower.includes("danh từ") || lower === "n" || lower === "n.";
      });
    }

    let formattedTerm = term;
    if (formattedTerm.length > 0 && !isNoun(partOfSpeech)) {
      const words = formattedTerm.split(" ");
      if (words.length === 1 && (formattedTerm !== formattedTerm.toUpperCase() || formattedTerm.length === 1)) {
        formattedTerm = formattedTerm.charAt(0).toLowerCase() + formattedTerm.slice(1);
      }
    }

    const importedWord: ImportedWord = {
      term: formattedTerm,
      translation,
      phonetic: typeof word.phonetic === "string" ? word.phonetic.trim() : "",
      partOfSpeech,
      exampleSentence:
        typeof word.exampleSentence === "string" ? word.exampleSentence.trim() : "",
      exampleTranslation:
        typeof word.exampleTranslation === "string" ? word.exampleTranslation.trim() : "",
    };

    const targetDestination =
      destination.type === "existing"
        ? { type: "existing" as const, deckId: destination.deckId }
        : {
            type: "new" as const,
            title: destination.title.normalize("NFC").trim(),
            description:
              typeof destination.description === "string"
                ? destination.description.normalize("NFC").trim()
                : "",
            level:
              typeof destination.level === "string" && destination.level.trim()
                ? destination.level.normalize("NFC").trim()
                : "Tự chọn",
          };

    const saved = await importVocabulary(targetDestination, [importedWord]);

    return NextResponse.json(
      {
        deck: saved.deck,
        added: saved.imported > 0,
        message:
          saved.imported > 0
            ? `Đã thêm từ "${term}" vào gói "${saved.deck.title}".`
            : `Từ "${term}" đã có sẵn trong gói "${saved.deck.title}".`,
      },
      { status: destination.type === "new" ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof ImportError) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: { message: "Không thể thêm từ vào gói vựng lúc này." } },
      { status: 503 },
    );
  }
}
