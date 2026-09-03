export type IpaCategory = "monophthong" | "diphthong" | "consonant";

export type WordPosition = "initial" | "medial" | "final";

export type IpaExample = {
  word: string;
  ipa: string;
  translation: string;
  position: WordPosition;
  highlightedLetters: string;
  audioUrl?: string;
};

export type SpellingPattern = {
  letters: string;
  examples: string[];
  note?: string;
};

export type MinimalPair = {
  targetWord: {
    word: string;
    ipa: string;
    translation: string;
  };
  confusedWord: {
    word: string;
    ipa: string;
    translation: string;
  };
  confusedSoundSymbol: string;
};

export type IpaSound = {
  id: string;
  symbol: string;
  name: string;
  vietnameseName: string;
  category: IpaCategory;
  typeLabel: string;
  audioUrl?: string;

  // 1. Định danh âm (Mô tả tính chất ngữ âm học)
  phoneticProperties: {
    voicing?: "voiced" | "voiceless"; // Hữu thanh / Vô thanh
    length?: "short" | "long";
    tonguePosition?: string; // Vị trí lưỡi
    jawOpening?: string; // Độ mở hàm
    lipShape?: string; // Khẩu hình môi
    mannerOfArticulation?: string; // Phương thức cấu âm (cho phụ âm)
    placeOfArticulation?: string; // Vị trí cấu âm (cho phụ âm)
    summary: string;
  };

  // 2. Cấu hình khẩu hình miệng
  articulation: {
    steps: string[];
    commonMistakes: string[];
    selfCheckTip: string;
  };

  // 3. Từ vựng ví dụ & Vị trí của âm trong từ
  examples: IpaExample[];

  // 4. Dấu hiệu nhận biết qua chữ viết (Spelling Patterns)
  spellingPatterns: SpellingPattern[];

  // 5. Cặp âm dễ nhầm lẫn (Minimal Pairs)
  minimalPairs: MinimalPair[];
};
