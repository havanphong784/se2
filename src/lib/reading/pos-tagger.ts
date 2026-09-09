import nlp from "compromise";
import type { POSTag, WordToken } from "@/types/reading";

export interface PosStyleDefinition {
  label: string;
  labelVi: string;
  textColor: string;
  twTextClass: string;
  bgBadge: string;
}

export const POS_STYLES: Record<POSTag, PosStyleDefinition> = {
  noun: {
    label: "Noun",
    labelVi: "Danh từ",
    textColor: "#0284c7",
    twTextClass: "text-[#0284c7] font-semibold",
    bgBadge: "bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]",
  },
  verb: {
    label: "Verb",
    labelVi: "Động từ",
    textColor: "#ea580c",
    twTextClass: "text-[#ea580c] font-semibold",
    bgBadge: "bg-[#ffedd5] text-[#c2410c] border-[#fed7aa]",
  },
  adjective: {
    label: "Adjective",
    labelVi: "Tính từ",
    textColor: "#9333ea",
    twTextClass: "text-[#9333ea] font-semibold",
    bgBadge: "bg-[#f3e8ff] text-[#7e22ce] border-[#e9d5ff]",
  },
  adverb: {
    label: "Adverb",
    labelVi: "Trạng từ",
    textColor: "#d97706",
    twTextClass: "text-[#d97706] font-semibold",
    bgBadge: "bg-[#fef3c7] text-[#b45309] border-[#fde68a]",
  },
  pronoun: {
    label: "Pronoun",
    labelVi: "Đại từ",
    textColor: "#0d9488",
    twTextClass: "text-[#0d9488] font-semibold",
    bgBadge: "bg-[#ccfbf1] text-[#0f766e] border-[#99f6e4]",
  },
  preposition: {
    label: "Preposition",
    labelVi: "Giới từ",
    textColor: "#4b5563",
    twTextClass: "text-[#4b5563] font-medium",
    bgBadge: "bg-[#f3f4f6] text-[#374151] border-[#e5e7eb]",
  },
  conjunction: {
    label: "Conjunction",
    labelVi: "Liên từ",
    textColor: "#e11d48",
    twTextClass: "text-[#e11d48] font-semibold",
    bgBadge: "bg-[#ffe4e6] text-[#be123c] border-[#fecdd3]",
  },
  determiner: {
    label: "Determiner",
    labelVi: "Mạo / Chỉ từ",
    textColor: "#64748b",
    twTextClass: "text-[#64748b] font-medium",
    bgBadge: "bg-[#f8fafc] text-[#475569] border-[#e2e8f0]",
  },
  other: {
    label: "Other",
    labelVi: "Khác",
    textColor: "#3c3c3c",
    twTextClass: "text-[#3c3c3c]",
    bgBadge: "bg-[#f5f5f5] text-[#555555] border-[#e5e5e5]",
  },
};

export function tagSentenceWords(sentence: string): WordToken[] {
  if (!sentence || !sentence.trim()) return [];

  try {
    const doc = nlp(sentence);
    const jsonResult = doc.json() as Array<{
      terms?: Array<{
        text: string;
        post?: string;
        tags?: string[];
      }>;
    }>;

    if (!jsonResult || !jsonResult.length || !jsonResult[0].terms) {
      // Fallback nếu NLP không phân tích được
      return sentence.split(/\s+/).map((word) => {
        const clean = word.replace(/^[^\w]+|[^\w]+$/g, "");
        return {
          text: word,
          cleanText: clean,
          pos: "other" as POSTag,
          isWord: clean.length > 0,
        };
      });
    }

    const tokens: WordToken[] = [];
    for (const term of jsonResult[0].terms) {
      const rawText = term.text || "";
      const postSpace = term.post || "";
      const clean = rawText.replace(/^[^\w]+|[^\w]+$/g, "");
      const tags = new Set((term.tags || []).map((t) => t.toLowerCase()));

      let pos: POSTag = "other";
      if (tags.has("noun")) pos = "noun";
      else if (tags.has("verb") || tags.has("auxiliary") || tags.has("modal")) pos = "verb";
      else if (tags.has("adjective")) pos = "adjective";
      else if (tags.has("adverb")) pos = "adverb";
      else if (tags.has("pronoun")) pos = "pronoun";
      else if (tags.has("preposition")) pos = "preposition";
      else if (tags.has("conjunction")) pos = "conjunction";
      else if (tags.has("determiner")) pos = "determiner";

      tokens.push({
        text: rawText + (postSpace && !postSpace.includes("\n") ? postSpace : " "),
        cleanText: clean,
        pos,
        isWord: clean.length > 0 && /[a-zA-Z]/.test(clean),
      });
    }

    return tokens;
  } catch {
    return sentence.split(/\s+/).map((word) => {
      const clean = word.replace(/^[^\w]+|[^\w]+$/g, "");
      return {
        text: word + " ",
        cleanText: clean,
        pos: "other" as POSTag,
        isWord: clean.length > 0,
      };
    });
  }
}
