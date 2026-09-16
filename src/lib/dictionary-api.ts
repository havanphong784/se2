export interface FreeDictionaryPhonetic {
  text?: string;
  audio?: string;
  sourceUrl?: string;
}

export interface FreeDictionaryDefinition {
  definition: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

export interface FreeDictionaryMeaning {
  partOfSpeech: string;
  definitions: FreeDictionaryDefinition[];
  synonyms?: string[];
  antonyms?: string[];
}

export interface FreeDictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics?: FreeDictionaryPhonetic[];
  meanings?: FreeDictionaryMeaning[];
  sourceUrls?: string[];
}

export interface FreeDictionaryParsed {
  word: string;
  phonetic: string;
  audioUrl: string | null;
  partsOfSpeech: string[];
  partsOfSpeechVi: string[];
  definition: string;
  exampleSentence: string;
  allDefinitions: Array<{
    partOfSpeech: string;
    partOfSpeechVi: string;
    definition: string;
    example?: string;
  }>;
}

export const POS_MAP_EN_TO_VI: Record<string, string> = {
  noun: "danh từ",
  verb: "động từ",
  adjective: "tính từ",
  adverb: "phó từ",
  pronoun: "đại từ",
  preposition: "giới từ",
  conjunction: "liên từ",
  interjection: "thán từ",
  article: "mạo từ",
  determiner: "hạn định từ",
  numeral: "từ chỉ số",
};

/**
 * Trích xuất audio URL sạch từ danh sách phonetics.
 * Ưu tiên URL audio hợp lệ đầu tiên, chuẩn hóa tiền tố https: nếu là protocol-relative.
 */
export function extractAudioUrl(phonetics?: FreeDictionaryPhonetic[]): string | null {
  if (!phonetics || !phonetics.length) return null;
  for (const item of phonetics) {
    if (item.audio && typeof item.audio === "string") {
      const trimmed = item.audio.trim();
      if (trimmed.length > 0) {
        if (trimmed.startsWith("//")) {
          return `https:${trimmed}`;
        }
        return trimmed;
      }
    }
  }
  return null;
}

/**
 * Trích xuất phiên âm IPA chuẩn từ entry.
 */
export function extractPhonetic(entry: FreeDictionaryEntry): string {
  if (entry.phonetic && entry.phonetic.trim()) {
    return entry.phonetic.trim();
  }
  if (entry.phonetics && entry.phonetics.length > 0) {
    const itemWithText = entry.phonetics.find(
      (p) => p.text && typeof p.text === "string" && p.text.trim().length > 0,
    );
    if (itemWithText?.text) {
      return itemWithText.text.trim();
    }
  }
  return "";
}

/**
 * Parse danh sách Free Dictionary entries sang cấu trúc dữ liệu tiện ích.
 */
export function parseFreeDictionaryEntries(
  entries: FreeDictionaryEntry[],
): FreeDictionaryParsed | null {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const entry = entries[0];
  if (!entry || !entry.word) return null;

  const phonetic = extractPhonetic(entry);
  const audioUrl = extractAudioUrl(entry.phonetics);

  const posSet = new Set<string>();
  const posViSet = new Set<string>();
  let definition = "";
  let exampleSentence = "";
  const allDefinitions: FreeDictionaryParsed["allDefinitions"] = [];

  if (entry.meanings && Array.isArray(entry.meanings)) {
    for (const meaning of entry.meanings) {
      const pos = meaning.partOfSpeech ? meaning.partOfSpeech.toLowerCase().trim() : "";
      if (pos) {
        posSet.add(pos);
        const posVi = POS_MAP_EN_TO_VI[pos] || pos;
        posViSet.add(posVi);
      }

      const posVi = POS_MAP_EN_TO_VI[pos] || pos;

      if (meaning.definitions && Array.isArray(meaning.definitions)) {
        for (const defItem of meaning.definitions) {
          if (defItem.definition && defItem.definition.trim()) {
            const defText = defItem.definition.trim();
            if (!definition) {
              definition = defText;
            }
            if (!exampleSentence && defItem.example && defItem.example.trim()) {
              exampleSentence = defItem.example.trim();
            }
            allDefinitions.push({
              partOfSpeech: pos,
              partOfSpeechVi: posVi,
              definition: defText,
              example: defItem.example?.trim() || undefined,
            });
          }
        }
      }
    }
  }

  return {
    word: entry.word,
    phonetic,
    audioUrl,
    partsOfSpeech: Array.from(posSet),
    partsOfSpeechVi: Array.from(posViSet),
    definition,
    exampleSentence,
    allDefinitions,
  };
}

/**
 * Gọi Free Dictionary API: https://api.dictionaryapi.dev/api/v2/entries/en/{word}
 */
export async function fetchFreeDictionaryWord(
  word: string,
  timeoutMs = 5000,
): Promise<FreeDictionaryParsed | null> {
  const cleanWord = word.trim().toLowerCase();
  if (!cleanWord) return null;

  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`,
      {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) return null;
    const data = (await response.json()) as FreeDictionaryEntry[];
    return parseFreeDictionaryEntries(data);
  } catch {
    return null;
  }
}
