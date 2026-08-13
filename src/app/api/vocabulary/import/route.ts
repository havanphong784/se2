import { NextResponse } from "next/server";

import { importVocabulary, ImportError } from "@/lib/vocabulary-import-server";
import {
  MAX_IMPORT_BYTES,
  parseVocabularyImport,
  type ImportFormat,
} from "@/lib/vocabulary-import";
import { isUuid } from "@/lib/server-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const format = form.get("format");
    const destination = form.get("destination");

    if (!(file instanceof File) || file.size > MAX_IMPORT_BYTES) {
      return NextResponse.json(
        { error: { code: "FILE_TOO_LARGE", message: "Tệp không hợp lệ hoặc vượt quá 2 MiB." } },
        { status: file instanceof File ? 413 : 400 },
      );
    }
    if (format !== "csv" && format !== "json") {
      return NextResponse.json(
        { error: { code: "UNSUPPORTED_FORMAT", message: "Chỉ hỗ trợ CSV hoặc JSON." } },
        { status: 415 },
      );
    }

    const parsed = parseVocabularyImport(await file.text(), format as ImportFormat);
    if (parsed.errors.length || !parsed.words.length) {
      return NextResponse.json(
        {
          error: {
            code: "IMPORT_VALIDATION_FAILED",
            message: "Tệp có dữ liệu chưa hợp lệ.",
            diagnostics: parsed.errors,
          },
        },
        { status: 400 },
      );
    }

    const target =
      destination === "existing"
        ? { type: "existing" as const, deckId: String(form.get("deckId") ?? "") }
        : {
            type: "new" as const,
            title: String(form.get("title") ?? ""),
            description: String(form.get("description") ?? ""),
            level: String(form.get("level") ?? ""),
          };
    if (target.type === "existing" && !isUuid(target.deckId)) {
      return NextResponse.json(
        { error: { code: "INVALID_DECK", message: "Bộ từ không hợp lệ." } },
        { status: 400 },
      );
    }

    const saved = await importVocabulary(target, parsed.words);
    return NextResponse.json(
      {
        deck: saved.deck,
        summary: {
          sourceRows: parsed.sourceRows,
          imported: saved.imported,
          skippedDuplicates: saved.skippedDuplicates + parsed.skippedDuplicates,
        },
        warnings: parsed.warnings,
      },
      { status: target.type === "new" ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof ImportError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("Vocabulary import failed.");
    return NextResponse.json(
      { error: { code: "IMPORT_FAILED", message: "Không thể nhập từ vựng lúc này." } },
      { status: 503 },
    );
  }
}
