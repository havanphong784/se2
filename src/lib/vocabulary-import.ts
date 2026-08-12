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
export type ImportedWord = Record<ImportField, string>;
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
    const word = Object.fromEntries(
      importFields.map((field) => [field, normalize(record[field], field, row, errors)]),
    ) as ImportedWord;
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
