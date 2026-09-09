import nlp from "compromise";
import type { WordToken, DetectedPhrase, IdiomPhrase } from "@/types/reading";

/**
 * Tìm dãy token liên tiếp khớp với các từ trong một cụm từ
 */
function findTokenSequence(
  tokens: WordToken[],
  phraseWords: string[]
): number[] | null {
  if (phraseWords.length === 0 || tokens.length < phraseWords.length) return null;

  const targetWords = phraseWords.map((w) => w.toLowerCase().replace(/^[^\w]+|[^\w]+$/g, ""));
  if (targetWords.some((w) => !w)) return null;

  for (let i = 0; i <= tokens.length - targetWords.length; i++) {
    // Chỉ bắt đầu từ một word token
    if (!tokens[i].isWord) continue;

    let matched = true;
    const indices: number[] = [];
    let targetIdx = 0;

    for (let j = i; j < tokens.length && targetIdx < targetWords.length; j++) {
      if (!tokens[j].isWord) {
        // Cho phép dấu gạch nối hoặc khoảng cách giữa các từ
        indices.push(j);
        continue;
      }

      if (tokens[j].cleanText.toLowerCase() === targetWords[targetIdx]) {
        indices.push(j);
        targetIdx++;
      } else {
        matched = false;
        break;
      }
    }

    if (matched && targetIdx === targetWords.length) {
      return indices;
    }
  }

  return null;
}

/**
 * Nhận diện tất cả các cụm từ (Collocations, Phrasal Verbs, Idioms) trong câu
 */
export function detectPhrasesInSentence(
  sentenceText: string,
  tokens: WordToken[],
  aiPhrases?: IdiomPhrase[]
): {
  phrases: DetectedPhrase[];
  tokenToPhraseMap: Map<number, DetectedPhrase>;
} {
  const detected: DetectedPhrase[] = [];
  const claimedTokenIndices = new Set<number>();

  // 1. Nhận diện từ AI Collocations & Idioms trước (Độ chính xác cao nhất)
  if (aiPhrases && aiPhrases.length > 0) {
    for (let idx = 0; idx < aiPhrases.length; idx++) {
      const item = aiPhrases[idx];
      const pWords = item.phrase.trim().split(/\s+/);
      if (pWords.length < 2) continue;

      const indices = findTokenSequence(tokens, pWords);
      if (indices && !indices.some((i) => claimedTokenIndices.has(i))) {
        const subWords = indices
          .map((i) => tokens[i])
          .filter((t) => t.isWord)
          .map((t) => ({
            word: t.text.trim(),
            cleanWord: t.cleanText,
            pos: t.pos,
          }));

        const phraseObj: DetectedPhrase = {
          id: `phrase-ai-${idx}-${indices[0]}`,
          phraseText: item.phrase,
          cleanPhrase: item.phrase.toLowerCase().trim(),
          tokenIndices: indices,
          type: "collocation",
          meaningVi: item.meaningVi,
          subWords,
        };

        detected.push(phraseObj);
        indices.forEach((i) => claimedTokenIndices.add(i));
      }
    }
  }

  // 2. Nhận diện Phrasal Verbs & Collocations qua NLP (Compromise.js)
  try {
    const doc = nlp(sentenceText);

    // Bắt phrasal verbs: (động từ đi kèm tiểu từ/giới từ)
    const phrasalMatches = doc.match("(#Verb && #PhrasalVerb)+ (#Particle|#Preposition)+").json() as Array<{ text: string }>;
    for (let i = 0; i < phrasalMatches.length; i++) {
      const matchText = phrasalMatches[i].text;
      const pWords = matchText.trim().split(/\s+/);
      if (pWords.length < 2) continue;

      const indices = findTokenSequence(tokens, pWords);
      if (indices && !indices.some((idx) => claimedTokenIndices.has(idx))) {
        const subWords = indices
          .map((idx) => tokens[idx])
          .filter((t) => t.isWord)
          .map((t) => ({
            word: t.text.trim(),
            cleanWord: t.cleanText,
            pos: t.pos,
          }));

        const phraseObj: DetectedPhrase = {
          id: `phrase-nlp-pv-${i}-${indices[0]}`,
          phraseText: matchText,
          cleanPhrase: matchText.toLowerCase().trim(),
          tokenIndices: indices,
          type: "phrasal_verb",
          subWords,
        };

        detected.push(phraseObj);
        indices.forEach((idx) => claimedTokenIndices.add(idx));
      }
    }

    // Bắt Adjective + Noun collocations (chỉ lấy 2-3 từ)
    const adjNounMatches = doc.match("#Adjective+ #Noun+").json() as Array<{ text: string }>;
    for (let i = 0; i < adjNounMatches.length; i++) {
      const matchText = adjNounMatches[i].text;
      const pWords = matchText.trim().split(/\s+/);
      if (pWords.length < 2 || pWords.length > 3) continue;

      const indices = findTokenSequence(tokens, pWords);
      if (indices && !indices.some((idx) => claimedTokenIndices.has(idx))) {
        const subWords = indices
          .map((idx) => tokens[idx])
          .filter((t) => t.isWord)
          .map((t) => ({
            word: t.text.trim(),
            cleanWord: t.cleanText,
            pos: t.pos,
          }));

        const phraseObj: DetectedPhrase = {
          id: `phrase-nlp-an-${i}-${indices[0]}`,
          phraseText: matchText,
          cleanPhrase: matchText.toLowerCase().trim(),
          tokenIndices: indices,
          type: "collocation",
          subWords,
        };

        detected.push(phraseObj);
        indices.forEach((idx) => claimedTokenIndices.add(idx));
      }
    }
  } catch {
    // NLP fallback
  }

  // Tạo map tra cứu nhanh từ token index sang DetectedPhrase
  const tokenToPhraseMap = new Map<number, DetectedPhrase>();
  for (const p of detected) {
    for (const idx of p.tokenIndices) {
      tokenToPhraseMap.set(idx, p);
    }
  }

  return {
    phrases: detected,
    tokenToPhraseMap,
  };
}
