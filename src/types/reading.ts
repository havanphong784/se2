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

export type SentenceComplexity = "micro" | "compound" | "complex" | "simple";

export interface SkeletonPart {
  type: "S" | "V" | "O" | "C" | "A";
  text: string;
  roleVi: string; // "Chủ ngữ" | "Động từ" | "Tân ngữ" | "Bổ ngữ" | "Trạng ngữ"
}

export interface SemanticChunk {
  chunkText: string;
  meaningVi: string;
  type: "noun_phrase" | "verb_phrase" | "prepositional_phrase" | "adverbial_phrase" | "clause" | string;
}

export interface WordFamilyItem {
  word: string;
  partOfSpeech: string;
}

export interface ContextualVocab {
  term: string;
  ipa: string;
  partOfSpeech: string;
  contextMeaningVi: string;
  cefr?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | string;
  synonyms?: string[];
  isTechnicalTerm?: boolean;
  wordFamily?: WordFamilyItem[];
}

export interface GrammarBreakdown {
  pattern: string;
  explanation: string;
  ruleSummary?: string;
  whyUsedVi?: string; // Lý do tác giả dùng cấu trúc này trong ngữ cảnh
  mechanicVi?: string; // Cơ chế cấu tạo (ví dụ chia động từ số ít, thì...)
  clauses: ClauseBreakdown[];
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
  complexity?: SentenceComplexity;
  translationVi: string;
  coreIdeaVi?: string; // Tầng 1: Ý chính cốt lõi ngắn gọn
  skeleton?: { // Tầng 2: Khung câu S-V-O-A
    pattern: string;
    parts: SkeletonPart[];
  };
  chunks?: SemanticChunk[]; // Tầng 4: Chia cụm nghĩa tự nhiên
  clauses?: ClauseBreakdown[];
  grammar: GrammarBreakdown; // Tầng 3 (clauses) & Tầng 6 (why, mechanic)
  vocabulary: ContextualVocab[]; // Tầng 5: Từ vựng + Word family + Tech term
  idiomsAndPhrases: IdiomPhrase[];
  mentalModelSteps?: string[]; // Tầng 7: Hướng dẫn tư duy đọc hiểu tự nhiên
  simplifiedEnglish?: string;
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


