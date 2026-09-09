export type POSTag =
  | "noun"
  | "verb"
  | "adjective"
  | "adverb"
  | "pronoun"
  | "preposition"
  | "conjunction"
  | "determiner"
  | "other";

export interface WordToken {
  text: string;
  cleanText: string;
  pos: POSTag;
  isWord: boolean;
}

export interface SentenceItem {
  id: string;
  text: string;
  paragraphIndex: number;
  tokens: WordToken[];
}

export type BlockType = "heading" | "paragraph" | "list_item" | "quote";

export interface ParagraphBlock {
  id: string;
  index: number;
  type: BlockType;
  headingLevel?: 1 | 2 | 3;
  sentences: SentenceItem[];
  rawText: string;
}

export interface ClauseBreakdown {
  clauseText: string;
  role: "Main Clause" | "Subordinate Clause" | "Relative Clause" | "Adverbial Clause" | string;
  subject: string;
  verb: string;
  objectOrComplement?: string;
}

export interface ContextualVocab {
  term: string;
  ipa: string;
  partOfSpeech: string;
  contextMeaningVi: string;
  cefr?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | string;
  synonyms?: string[];
}

export interface IdiomPhrase {
  phrase: string;
  meaningVi: string;
}

export interface SentenceBreakdownResponse {
  sentence: string;
  translationVi: string;
  simplifiedEnglish: string;
  grammar: {
    pattern: string;
    explanation: string;
    clauses: ClauseBreakdown[];
  };
  vocabulary: ContextualVocab[];
  idiomsAndPhrases: IdiomPhrase[];
}

export interface ClientAIConfig {
  provider: "local_tunnel" | "custom_openai";
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  autoAnalyzeOnClick?: boolean;
}

export interface ReadingDocument {
  id: string;
  userId: string;
  title: string;
  sourceType: "raw_text" | "pdf" | "image";
  originalFileName?: string;
  rawContent: string;
  totalWords: number;
  estimatedCefr?: string;
  createdAt: string;
  updatedAt: string;
}
