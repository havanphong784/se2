import type {
  ClauseBreakdown,
  ContextualVocab,
  GrammarBreakdown,
  IdiomPhrase,
  SemanticChunk,
  SentenceBreakdownResponse,
  SentenceComplexity,
  SkeletonPart,
  WordFamilyItem,
} from "@/types/reading";
import { getCachedWord } from "@/lib/reading/dictionary-cache";

export const ROLE_MAP: Record<string, string> = {
  S: "Chủ ngữ",
  V: "Động từ",
  O: "Tân ngữ",
  C: "Bổ ngữ",
  A: "Trạng ngữ",
};

/**
 * State machine tự động sửa chữa và đóng các ngoặc {, [ và dấu nháy " bị thiếu
 * khi JSON trả về từ mô hình AI bị cắt cụt giữa chừng.
 */
export function repairTruncatedJson(rawText: string): string {
  if (!rawText || typeof rawText !== "string") return "{}";

  let text = rawText.trim();

  // Bỏ khối markdown ```json ... ```
  text = text.replace(/^```(?:json)?\s*/i, "");
  text = text.replace(/\s*```$/i, "").trim();

  // Tìm vị trí mở object { hoặc array [ đầu tiên
  const firstBrace = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  let startIndex = -1;

  if (firstBrace !== -1 && firstBracket !== -1) {
    startIndex = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIndex = firstBrace;
  } else if (firstBracket !== -1) {
    startIndex = firstBracket;
  }

  if (startIndex === -1) {
    return "{}";
  }

  text = text.slice(startIndex).trim();

  // Thử parse ngay nếu JSON đã hoàn chỉnh
  try {
    JSON.parse(text);
    return text;
  } catch {
    // Nếu lỗi cú pháp, tiếp tục vào state machine sửa chữa
  }

  // State machine lặp tối đa 30 lần với cơ chế backtrack khi gặp key dở dang
  for (let attempt = 0; attempt < 30; attempt++) {
    const stack: string[] = [];
    let inString = false;
    let isEscaped = false;
    let repaired = "";

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (inString) {
        if (isEscaped) {
          isEscaped = false;
          repaired += char;
        } else if (char === "\\") {
          isEscaped = true;
          repaired += char;
        } else if (char === '"') {
          inString = false;
          repaired += char;
        } else if (char === "\n") {
          // Thoát ký tự xuống dòng trần trong chuỗi JSON để tránh SyntaxError
          repaired += "\\n";
        } else if (char === "\r") {
          // Bỏ qua carriage return
        } else if (char === "\t") {
          repaired += "\\t";
        } else {
          repaired += char;
        }
      } else {
        if (char === '"') {
          inString = true;
          repaired += char;
        } else if (char === "{") {
          stack.push("}");
          repaired += char;
        } else if (char === "[") {
          stack.push("]");
          repaired += char;
        } else if (char === "}") {
          if (stack.length > 0 && stack[stack.length - 1] === "}") {
            stack.pop();
          }
          repaired += char;
        } else if (char === "]") {
          if (stack.length > 0 && stack[stack.length - 1] === "]") {
            stack.pop();
          }
          repaired += char;
        } else {
          repaired += char;
        }
      }
    }

    // Nếu chuỗi đang mở dở dang ở cuối
    if (inString) {
      if (isEscaped) {
        // Cắt bỏ ký tự \ dở dang
        repaired = repaired.slice(0, -1);
      }
      repaired += '"';
    }

    repaired = repaired.trim();

    // Nếu kết thúc bằng dấu hai chấm (ví dụ: "key": ), điền giá trị rỗng tạm thời
    if (repaired.endsWith(":")) {
      repaired += '""';
    }

    // Xóa dấu phẩy treo ở cuối
    repaired = repaired.replace(/,\s*$/, "");

    // Đóng toàn bộ các ngoặc mở còn lại theo đúng thứ tự stack
    const closingChars = stack.slice().reverse().join("");
    const candidate = repaired + closingChars;

    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Nếu candidate vẫn lỗi cú pháp (thường do key không có value ở đuôi),
      // backtrack bằng cách cắt lùi tới dấu phẩy hoặc dấu mở ngoặc gần nhất
      const lastComma = text.lastIndexOf(",");
      const lastOpenBrace = text.lastIndexOf("{");
      const lastOpenBracket = text.lastIndexOf("[");
      const cutPoint = Math.max(lastComma, lastOpenBrace, lastOpenBracket);

      if (cutPoint <= 0) {
        break;
      }

      if (cutPoint === lastComma) {
        text = text.slice(0, lastComma);
      } else {
        text = text.slice(0, cutPoint + 1);
      }
    }
  }

  return "{}";
}

/**
 * Làm giàu dữ liệu Client-side:
 * 1. Tự động tra và gán phiên âm IPA chuẩn từ dictionary-cache.ts nếu thiếu
 * 2. Gán roleVi chuẩn ("Chủ ngữ", "Động từ",...) cho skeleton.parts theo ROLE_MAP
 */
export function enrichSentenceBreakdown(
  breakdown: SentenceBreakdownResponse
): SentenceBreakdownResponse {
  if (!breakdown) return breakdown;

  // Đồng bộ clauses giữa root và grammar để tương thích cả 2 cách truy cập
  if (breakdown.clauses && breakdown.clauses.length > 0 && (!breakdown.grammar?.clauses || breakdown.grammar.clauses.length === 0)) {
    if (breakdown.grammar) {
      breakdown.grammar.clauses = breakdown.clauses;
    }
  } else if ((!breakdown.clauses || breakdown.clauses.length === 0) && breakdown.grammar?.clauses && breakdown.grammar.clauses.length > 0) {
    breakdown.clauses = breakdown.grammar.clauses;
  }

  // 1. Enrich roleVi cho skeleton.parts
  if (breakdown.skeleton?.parts && Array.isArray(breakdown.skeleton.parts)) {
    breakdown.skeleton.parts = breakdown.skeleton.parts.map((p) => {
      const rawType = (p?.type || "S").toUpperCase();
      const validTypes: Array<"S" | "V" | "O" | "C" | "A"> = ["S", "V", "O", "C", "A"];
      const type: "S" | "V" | "O" | "C" | "A" = validTypes.includes(
        rawType as "S" | "V" | "O" | "C" | "A"
      )
        ? (rawType as "S" | "V" | "O" | "C" | "A")
        : "S";

      const currentRole = p?.roleVi?.trim();
      const roleVi =
        currentRole && currentRole !== "Thành phần câu"
          ? currentRole
          : ROLE_MAP[type] || "Thành phần câu";

      return {
        ...p,
        type,
        text: p?.text || "",
        roleVi,
      };
    });
  }

  // 2. Enrich IPA từ dictionary-cache
  if (Array.isArray(breakdown.vocabulary)) {
    breakdown.vocabulary = breakdown.vocabulary.map((v) => {
      if (v?.ipa && typeof v.ipa === "string" && v.ipa.trim()) {
        return v;
      }
      if (!v?.term) return v;

      const clean = v.term.toLowerCase().trim().replace(/^[^\w]+|[^\w]+$/g, "");
      const cached = getCachedWord(clean) || getCachedWord(v.term.toLowerCase().trim());
      return {
        ...v,
        ipa: cached?.phonetic || "",
      };
    });
  }

  return breakdown;
}

/**
 * Bóc tách, repair và validate schema cho SentenceBreakdownResponse,
 * tự động bù đắp fallback cho mọi trường thiếu để UI không bao giờ bị crash.
 */
export function safeParseSentenceBreakdown(
  rawText: string,
  targetSentence: string = ""
): SentenceBreakdownResponse {
  let parsed: Record<string, unknown> = {};

  try {
    const repaired = repairTruncatedJson(rawText);
    parsed = JSON.parse(repaired);
  } catch {
    parsed = {};
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    parsed = {};
  }

  // Sentence
  const sentence =
    typeof parsed.sentence === "string" && parsed.sentence.trim()
      ? parsed.sentence.trim()
      : targetSentence;

  // Complexity
  const validComplexities: SentenceComplexity[] = ["micro", "simple", "compound", "complex"];
  const rawComplexity = parsed.complexity as SentenceComplexity;
  const complexity: SentenceComplexity = validComplexities.includes(rawComplexity)
    ? rawComplexity
    : "simple";

  // Translations and core idea
  const translationVi =
    typeof parsed.translationVi === "string" && parsed.translationVi.trim()
      ? parsed.translationVi.trim()
      : typeof parsed.translation === "string" && parsed.translation.trim()
        ? parsed.translation.trim()
        : typeof parsed.vietnamese_translation === "string" && parsed.vietnamese_translation.trim()
          ? parsed.vietnamese_translation.trim()
          : typeof parsed.vietnameseTranslation === "string" && parsed.vietnameseTranslation.trim()
            ? parsed.vietnameseTranslation.trim()
            : typeof parsed.meaning_vi === "string" && parsed.meaning_vi.trim()
              ? parsed.meaning_vi.trim()
              : typeof parsed.vietnamese === "string" && parsed.vietnamese.trim()
                ? parsed.vietnamese.trim()
                : "";

  const coreIdeaVi =
    typeof parsed.coreIdeaVi === "string" && parsed.coreIdeaVi.trim()
      ? parsed.coreIdeaVi.trim()
      : typeof parsed.core_idea === "string" && parsed.core_idea.trim()
        ? parsed.core_idea.trim()
        : typeof parsed.coreIdea === "string" && parsed.coreIdea.trim()
          ? parsed.coreIdea.trim()
          : typeof parsed.summary === "string" && parsed.summary.trim()
            ? parsed.summary.trim()
            : typeof parsed.main_point === "string" && parsed.main_point.trim()
              ? parsed.main_point.trim()
              : "";

  const simplifiedEnglish =
    typeof parsed.simplifiedEnglish === "string" && parsed.simplifiedEnglish.trim()
      ? parsed.simplifiedEnglish.trim()
      : typeof parsed.simplified_english === "string" && parsed.simplified_english.trim()
        ? parsed.simplified_english.trim()
        : typeof parsed.simple_english === "string" && parsed.simple_english.trim()
          ? parsed.simple_english.trim()
          : typeof parsed.paraphrase === "string" && parsed.paraphrase.trim()
            ? parsed.paraphrase.trim()
            : "";

  // Skeleton
  let skeleton: { pattern: string; parts: SkeletonPart[] };
  const rawSkeleton = (parsed.skeleton ||
    parsed.syntax_analysis ||
    parsed.syntax ||
    parsed.structure ||
    parsed.sentence_structure) as Record<string, unknown> | undefined;

  if (!rawSkeleton || typeof rawSkeleton !== "object") {
    skeleton = { pattern: "S + V + O", parts: [] };
  } else if (Array.isArray(rawSkeleton.parts)) {
    const pattern =
      typeof rawSkeleton.pattern === "string" && rawSkeleton.pattern.trim()
        ? rawSkeleton.pattern.trim()
        : "S + V + O";

    const parts: SkeletonPart[] = rawSkeleton.parts.map(
      (p: { type?: unknown; text?: unknown; roleVi?: unknown }) => {
        const rawType = String(p?.type || "S").toUpperCase();
        const validTypes: Array<"S" | "V" | "O" | "C" | "A"> = ["S", "V", "O", "C", "A"];
        const type: "S" | "V" | "O" | "C" | "A" = validTypes.includes(
          rawType as "S" | "V" | "O" | "C" | "A"
        )
          ? (rawType as "S" | "V" | "O" | "C" | "A")
          : "S";
        const text = typeof p?.text === "string" ? p.text : "";
        const roleVi =
          typeof p?.roleVi === "string" && p.roleVi.trim()
            ? p.roleVi.trim()
            : ROLE_MAP[type] || "Thành phần câu";
        return { type, text, roleVi };
      }
    );

    skeleton = { pattern, parts };
  } else {
    // Model trả về cú pháp dạng object: { subject: "...", verb: "...", object: "...", ... }
    const parts: SkeletonPart[] = [];
    const extractText = (val: unknown): string => {
      if (!val) return "";
      if (typeof val === "string") return val.trim();
      if (typeof val === "object" && val !== null && "text" in val) {
        return String((val as { text: unknown }).text || "").trim();
      }
      return "";
    };

    const sText = extractText(rawSkeleton.subject || rawSkeleton.S);
    if (sText) parts.push({ type: "S", text: sText, roleVi: ROLE_MAP.S });

    const vText = extractText(rawSkeleton.verb || rawSkeleton.verb_phrase || rawSkeleton.V);
    if (vText) parts.push({ type: "V", text: vText, roleVi: ROLE_MAP.V });

    const oText = extractText(rawSkeleton.object || rawSkeleton.object_phrase || rawSkeleton.O);
    if (oText) parts.push({ type: "O", text: oText, roleVi: ROLE_MAP.O });

    const cText = extractText(rawSkeleton.complement || rawSkeleton.C);
    if (cText) parts.push({ type: "C", text: cText, roleVi: ROLE_MAP.C });

    const aText = extractText(
      rawSkeleton.adverbial ||
        rawSkeleton.prepositional_phrase ||
        rawSkeleton.transition ||
        rawSkeleton.modifier ||
        rawSkeleton.A
    );
    if (aText) parts.push({ type: "A", text: aText, roleVi: ROLE_MAP.A });

    const pattern =
      typeof rawSkeleton.pattern === "string" && rawSkeleton.pattern.trim()
        ? rawSkeleton.pattern.trim()
        : parts.map((p) => p.type).join(" + ") || "S + V + O";

    skeleton = { pattern, parts };
  }

  // Semantic Chunks
  const rawChunks =
    parsed.chunks || parsed.semantic_chunks || parsed.thought_groups || parsed.phrases;
  const chunks: SemanticChunk[] = Array.isArray(rawChunks)
    ? rawChunks.map(
        (c: { chunkText?: unknown; text?: unknown; meaningVi?: unknown; meaning?: unknown; type?: unknown }) => ({
          chunkText:
            typeof c?.chunkText === "string"
              ? c.chunkText
              : typeof c?.text === "string"
                ? c.text
                : "",
          meaningVi:
            typeof c?.meaningVi === "string"
              ? c.meaningVi
              : typeof c?.meaning === "string"
                ? c.meaning
                : "",
          type: typeof c?.type === "string" ? c.type : "noun_phrase",
        })
      )
    : [];

  // Clauses
  const rootClauses = parsed.clauses || parsed.clause_breakdown;
  const rawGrammar = parsed.grammar as { clauses?: unknown } | undefined;
  const grammarClauses = rawGrammar?.clauses;
  const rawClauses = Array.isArray(rootClauses)
    ? rootClauses
    : Array.isArray(grammarClauses)
      ? grammarClauses
      : [];

  const clauses: ClauseBreakdown[] = rawClauses.map(
    (c: {
      clauseText?: unknown;
      text?: unknown;
      role?: unknown;
      subject?: unknown;
      verb?: unknown;
      objectOrComplement?: unknown;
    }) => ({
      clauseText:
        typeof c?.clauseText === "string"
          ? c.clauseText
          : typeof c?.text === "string"
            ? c.text
            : "",
      role: typeof c?.role === "string" && c.role.trim() ? c.role.trim() : "Main Clause",
      subject: typeof c?.subject === "string" ? c.subject : "",
      verb: typeof c?.verb === "string" ? c.verb : "",
      objectOrComplement: typeof c?.objectOrComplement === "string" ? c.objectOrComplement : "",
    })
  );

  // Grammar
  const grammarObj = parsed.grammar as
    | {
        pattern?: unknown;
        explanation?: unknown;
        ruleSummary?: unknown;
        rule_summary?: unknown;
        whyUsedVi?: unknown;
        why_used?: unknown;
        mechanicVi?: unknown;
        mechanic?: unknown;
      }
    | undefined;

  const grammar: GrammarBreakdown = {
    pattern:
      typeof grammarObj?.pattern === "string" && grammarObj.pattern.trim()
        ? grammarObj.pattern.trim()
        : "Standard Structure",
    explanation:
      typeof grammarObj?.explanation === "string" && grammarObj.explanation.trim()
        ? grammarObj.explanation.trim()
        : typeof parsed.grammar_explanation === "string" && parsed.grammar_explanation.trim()
          ? parsed.grammar_explanation.trim()
          : "Cấu trúc câu tiêu chuẩn",
    ruleSummary:
      typeof grammarObj?.ruleSummary === "string"
        ? grammarObj.ruleSummary
        : typeof grammarObj?.rule_summary === "string"
          ? grammarObj.rule_summary
          : "",
    whyUsedVi:
      typeof grammarObj?.whyUsedVi === "string"
        ? grammarObj.whyUsedVi
        : typeof grammarObj?.why_used === "string"
          ? grammarObj.why_used
          : "",
    mechanicVi:
      typeof grammarObj?.mechanicVi === "string"
        ? grammarObj.mechanicVi
        : typeof grammarObj?.mechanic === "string"
          ? grammarObj.mechanic
          : typeof parsed.grammar_rules === "string"
            ? parsed.grammar_rules
            : "",
    clauses,
  };

  // Vocabulary (Bảo toàn toàn bộ danh sách từ vựng, không truncate)
  const rawVocab = parsed.vocabulary || parsed.vocab || parsed.key_words || parsed.keywords;
  const vocabulary: ContextualVocab[] = Array.isArray(rawVocab)
    ? rawVocab.map(
        (v: {
          term?: unknown;
          word?: unknown;
          ipa?: unknown;
          partOfSpeech?: unknown;
          type?: unknown;
          pos?: unknown;
          contextMeaningVi?: unknown;
          meaningVi?: unknown;
          meaning?: unknown;
          vietnamese?: unknown;
          cefr?: unknown;
          synonyms?: unknown;
          isTechnicalTerm?: unknown;
          wordFamily?: unknown;
        }) => {
          const term =
            typeof v?.term === "string"
              ? v.term
              : typeof v?.word === "string"
                ? v.word
                : "";
          const ipa = typeof v?.ipa === "string" ? v.ipa : "";
          const partOfSpeech =
            typeof v?.partOfSpeech === "string"
              ? v.partOfSpeech
              : typeof v?.type === "string"
                ? v.type
                : typeof v?.pos === "string"
                  ? v.pos
                  : "";
          const contextMeaningVi =
            typeof v?.contextMeaningVi === "string"
              ? v.contextMeaningVi
              : typeof v?.meaningVi === "string"
                ? v.meaningVi
                : typeof v?.meaning === "string"
                  ? v.meaning
                  : typeof v?.vietnamese === "string"
                    ? v.vietnamese
                    : "";
          const cefr = typeof v?.cefr === "string" ? v.cefr : undefined;
          const synonyms = Array.isArray(v?.synonyms)
            ? v.synonyms.map(String).filter(Boolean)
            : [];
          const isTechnicalTerm = Boolean(v?.isTechnicalTerm);
          const wordFamily: WordFamilyItem[] = Array.isArray(v?.wordFamily)
            ? v.wordFamily.map((wf: { word?: unknown; partOfSpeech?: unknown }) => ({
                word: typeof wf?.word === "string" ? wf.word : "",
                partOfSpeech: typeof wf?.partOfSpeech === "string" ? wf.partOfSpeech : "",
              }))
            : [];

          return {
            term,
            ipa,
            partOfSpeech,
            contextMeaningVi,
            cefr,
            synonyms,
            isTechnicalTerm,
            wordFamily,
          };
        }
      )
    : [];

  // Idioms & Phrases
  const rawIdioms = parsed.idiomsAndPhrases || parsed.idioms || parsed.phrases;
  const idiomsAndPhrases: IdiomPhrase[] = Array.isArray(rawIdioms)
    ? rawIdioms.map((i: { phrase?: unknown; meaningVi?: unknown }) => ({
        phrase: typeof i?.phrase === "string" ? i.phrase : "",
        meaningVi: typeof i?.meaningVi === "string" ? i.meaningVi : "",
      }))
    : [];

  // Mental Model Steps
  const rawSteps =
    parsed.mentalModelSteps ||
    parsed.mental_model ||
    parsed.reading_steps ||
    parsed.thought_process;
  const mentalModelSteps: string[] = Array.isArray(rawSteps)
    ? rawSteps
        .map((s: unknown) => {
          if (typeof s === "string") return s.trim();
          if (typeof s === "object" && s !== null) {
            const stepObj = s as Record<string, unknown>;
            const anchor = String(stepObj.anchorText || stepObj.text || "");
            const action = String(stepObj.actionVi || stepObj.action || "");
            const why = String(stepObj.cognitiveWhyVi || stepObj.why || "");
            if (anchor || action) {
              return `[${anchor}] ${action}${why ? ` (${why})` : ""}`;
            }
          }
          return "";
        })
        .filter(Boolean)
    : [];

  const result: SentenceBreakdownResponse = {
    sentence,
    complexity,
    translationVi,
    coreIdeaVi,
    skeleton,
    chunks,
    clauses,
    grammar,
    vocabulary,
    idiomsAndPhrases,
    mentalModelSteps,
    simplifiedEnglish,
  };

  return enrichSentenceBreakdown(result);
}
