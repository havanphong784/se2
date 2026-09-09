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

export interface DetectedPhrase {
  id: string;
  phraseText: string;
  cleanPhrase: string;
  tokenIndices: number[];
  type: "collocation" | "phrasal_verb" | "idiom" | "selection";
  meaningVi?: string;
  subWords: Array<{
    word: string;
    cleanWord: string;
    pos: POSTag;
  }>;
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
  sourceType: "raw_text" | "pdf" | "docx" | "image";
  originalFileName?: string;
  rawContent: string;
  totalWords: number;
  estimatedCefr?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TableOfContentItem {
  id: string;
  title: string;
  level: 1 | 2 | 3;
  pageNumber: number;
  chunkIndex: number;
}

export interface DocumentChunk {
  chunkIndex: number;
  startPage: number;
  endPage: number;
  chapterTitle?: string;
  rawText: string;
  totalWords?: number;
}

export interface StructuredDocumentMeta {
  id: string;
  title: string;
  sourceType: "raw_text" | "pdf" | "docx" | "image";
  originalFileName?: string;
  totalPages: number;
  totalChunks: number;
  pagesPerChunk: number;
  totalWords: number;
  totalSentences: number;
  toc: TableOfContentItem[];
  activeChunkIndex: number;
  lastReadSentenceId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface VdocSessionState {
  activeChunkIndex: number;
  lastReadSentenceId?: string;
  savedWordsCount: number;
  analyzedSentencesCount: number;
  lastSavedAt: number;
}

export interface VdocSavedWord {
  term: string;
  translation: string;
  phonetic: string;
  savedAt: number;
}

export interface VdocPackage {
  schema: "vocabloom.vdoc.v1";
  version: "1.0";
  id: string;
  meta: StructuredDocumentMeta;
  sessionState: VdocSessionState;
  chunks: DocumentChunk[];
  aiAnalysesCache: Record<string, SentenceBreakdownResponse>;
  savedWords: VdocSavedWord[];
}


