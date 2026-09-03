import Papa from "papaparse";

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 2_000;
export const importFields = [
  "term",
  "translation",
  "phonetic",
  "partOfSpeech",
  "exampleSentence",
  "exampleTranslation",
] as const;

export type ImportFormat = "csv" | "json";
export type ImportField = (typeof importFields)[number];
export type ImportedWord = Omit<Record<ImportField, string>, "partOfSpeech"> & {
  partOfSpeech: string[];
};
export type ImportDiagnostic = {
  row: number;
  field?: ImportField;
  message: string;
};
export type ImportParseResult = {
  words: ImportedWord[];
  sourceRows: number;
  skippedDuplicates: number;
  errors: ImportDiagnostic[];
  warnings: string[];
};

const limits: Record<ImportField, number> = {
  term: 200,
  translation: 500,
  phonetic: 200,
  partOfSpeech: 100,
  exampleSentence: 2_000,
  exampleTranslation: 2_000,
};
const MAX_PARTS_OF_SPEECH = 20;

function normalize(value: unknown, field: ImportField, row: number, errors: ImportDiagnostic[]) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    errors.push({ row, field, message: `${field} phải là chuỗi.` });
    return "";
  }
  const normalized = value.normalize("NFC").trim();
  if ([...normalized].length > limits[field]) {
    errors.push({ row, field, message: `${field} vượt quá ${limits[field]} ký tự.` });
  }
  return normalized;
}

function normalizePartsOfSpeech(
  value: unknown,
  row: number,
  errors: ImportDiagnostic[],
): string[] {
  if (
    value === undefined ||
    value === null ||
    (typeof value === "string" && !value.trim())
  )
    return [];
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : null;
  if (!values) {
    errors.push({
      row,
      field: "partOfSpeech",
      message: "partOfSpeech phải là chuỗi hoặc mảng chuỗi.",
    });
    return [];
  }
  if (values.length > MAX_PARTS_OF_SPEECH) {
    errors.push({
      row,
      field: "partOfSpeech",
      message: `partOfSpeech không được vượt quá ${MAX_PARTS_OF_SPEECH} giá trị.`,
    });
  }

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const item of values) {
    if (typeof item !== "string") {
      errors.push({
        row,
        field: "partOfSpeech",
        message: "partOfSpeech chỉ được chứa chuỗi.",
      });
      continue;
    }
    const part = item.normalize("NFC").trim();
    if (!part) {
      errors.push({
        row,
        field: "partOfSpeech",
        message: "partOfSpeech không được chứa giá trị rỗng.",
      });
      continue;
    }
    if ([...part].length > limits.partOfSpeech) {
      errors.push({
        row,
        field: "partOfSpeech",
        message: `Mỗi loại từ không được vượt quá ${limits.partOfSpeech} ký tự.`,
      });
      continue;
    }
    const key = part.toLocaleLowerCase("vi");
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push(part);
    }
  }
  return normalized;
}

function validateRows(rows: unknown[], rowOffset = 1): ImportParseResult {
  const errors: ImportDiagnostic[] = [];
  const words: ImportedWord[] = [];
  const seen = new Set<string>();
  let skippedDuplicates = 0;

  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      words: [],
      sourceRows: rows.length,
      skippedDuplicates: 0,
      errors: [{ row: 0, message: `Tệp vượt quá ${MAX_IMPORT_ROWS} dòng.` }],
      warnings: [],
    };
  }

  rows.forEach((raw, index) => {
    const row = index + rowOffset;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push({ row, message: "Dòng phải là một object." });
      return;
    }
    const record = raw as Record<string, unknown>;
    const word: ImportedWord = {
      term: normalize(record.term, "term", row, errors),
      translation: normalize(record.translation, "translation", row, errors),
      phonetic: normalize(record.phonetic, "phonetic", row, errors),
      partOfSpeech: normalizePartsOfSpeech(record.partOfSpeech, row, errors),
      exampleSentence: normalize(record.exampleSentence, "exampleSentence", row, errors),
      exampleTranslation: normalize(
        record.exampleTranslation,
        "exampleTranslation",
        row,
        errors,
      ),
    };
    if (!word.term) errors.push({ row, field: "term", message: "Thiếu term." });
    if (!word.translation) {
      errors.push({ row, field: "translation", message: "Thiếu translation." });
    }
    if (!word.term || !word.translation) return;
    if (seen.has(word.term)) {
      skippedDuplicates += 1;
      return;
    }
    seen.add(word.term);
    words.push(word);
  });

  return { words, sourceRows: rows.length, skippedDuplicates, errors, warnings: [] };
}

export function parseVocabularyImport(text: string, format: ImportFormat): ImportParseResult {
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) {
    return {
      words: [],
      sourceRows: 0,
      skippedDuplicates: 0,
      errors: [{ row: 0, message: "Tệp vượt quá giới hạn 2 MiB." }],
      warnings: [],
    };
  }

  if (format === "json") {
    try {
      const value: unknown = JSON.parse(text);
      if (!Array.isArray(value)) {
        return {
          words: [],
          sourceRows: 0,
          skippedDuplicates: 0,
          errors: [{ row: 0, message: "JSON phải là một mảng từ vựng." }],
          warnings: [],
        };
      }
      return validateRows(value);
    } catch {
      return {
        words: [],
        sourceRows: 0,
        skippedDuplicates: 0,
        errors: [{ row: 0, message: "JSON không hợp lệ." }],
        warnings: [],
      };
    }
  }

  const parsed = Papa.parse<Record<string, unknown>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
  });
  const headers = parsed.meta.fields ?? [];
  const errors: ImportDiagnostic[] = parsed.errors.map((error) => ({
    row: error.row === undefined ? 0 : error.row + 2,
    message: error.message,
  }));
  for (const required of ["term", "translation"]) {
    if (!headers.includes(required)) errors.push({ row: 1, message: `Thiếu cột ${required}.` });
  }
  if (new Set(headers).size !== headers.length) {
    errors.push({ row: 1, message: "Tên cột không được lặp lại." });
  }
  const result = validateRows(parsed.data, 2);
  result.errors.unshift(...errors);
  result.warnings = headers
    .filter((header) => !importFields.includes(header as ImportField))
    .map((header) => `Bỏ qua cột không hỗ trợ: ${header}`);
  return result;
}
