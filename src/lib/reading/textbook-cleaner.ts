/**
 * Textbook & Academic Document Artifact Cleaner
 * Xử lý triệt để các lỗi rách chữ, dính cột, hỏng bullet, ngắt dòng do kerning
 * trên giáo trình và tài liệu học thuật theo tiêu chuẩn Document Reader Engineering.
 */

// Danh sách từ ghép thực sự bắt buộc bảo toàn dấu gạch nối (True Compound Words)
const TRUE_COMPOUND_WORDS = new Set<string>([
  "state-of-the-art",
  "well-known",
  "multi-tiered",
  "multi-threaded",
  "multi-core",
  "multi-processor",
  "multi-tasking",
  "multi-user",
  "multi-level",
  "multi-hop",
  "multi-factor",
  "user-friendly",
  "real-time",
  "object-oriented",
  "open-source",
  "closed-source",
  "high-performance",
  "high-level",
  "low-level",
  "high-speed",
  "low-latency",
  "built-in",
  "trade-off",
  "trade-offs",
  "end-to-end",
  "peer-to-peer",
  "point-to-point",
  "cross-platform",
  "cross-cutting",
  "cross-origin",
  "single-threaded",
  "single-core",
  "single-user",
  "cost-effective",
  "large-scale",
  "small-scale",
  "medium-scale",
  "full-stack",
  "server-side",
  "client-side",
  "in-depth",
  "up-to-date",
  "out-of-date",
  "long-term",
  "short-term",
  "read-only",
  "write-only",
  "read-write",
  "plug-in",
  "plug-and-play",
  "round-robin",
  "time-sharing",
  "general-purpose",
  "special-purpose",
  "self-contained",
  "self-healing",
  "self-service",
  "self-driving",
  "fault-tolerant",
  "mission-critical",
  "event-driven",
  "data-driven",
  "domain-driven",
  "cache-coherent",
  "memory-mapped",
  "lock-free",
  "wait-free",
  "thread-safe",
  "type-safe",
  "zero-copy",
  "off-the-shelf",
  "cutting-edge",
  "know-how",
  "stand-alone",
  "fine-grained",
  "coarse-grained",
  "command-line",
  "write-ahead",
]);

// Các tiền tố luôn đi kèm dấu gạch nối trong tài liệu kỹ thuật
const COMPOUND_PREFIXES = new Set<string>([
  "state-of",
  "multi",
  "well",
  "self",
  "cross",
  "end-to",
  "peer-to",
  "point-to",
  "all",
  "high",
  "low",
  "real",
  "user",
  "trade",
  "single",
  "cost",
  "large",
  "server",
  "client",
]);

// Danh sách các từ tiếng Anh phổ biến đứng độc lập (Guard tránh ghép bừa bãi)
const STANDALONE_WORDS = new Set<string>([
  "a", "an", "the", "in", "on", "at", "to", "for", "of", "with", "by", "from",
  "is", "am", "are", "was", "were", "be", "been", "being",
  "it", "its", "he", "she", "we", "they", "i", "you", "me", "him", "her", "us", "them",
  "this", "that", "these", "those",
  "my", "your", "his", "our", "their",
  "and", "or", "but", "so", "if", "as", "than", "nor", "yet",
  "not", "no", "can", "will", "may", "must", "should", "would", "could", "shall",
  "do", "does", "did", "have", "has", "had",
  "book", "room", "cat", "dog", "man", "car", "day", "way", "time", "year",
  "part", "case", "point", "end", "line", "page", "text", "view", "hand", "eye",
  "all", "any", "some", "one", "two", "new", "old", "good", "bad", "high", "low",
  "big", "small", "great", "long", "first", "last", "right", "left", "next",
  "up", "down", "out", "over", "into", "then", "now", "here", "there",
  "how", "why", "when", "where", "what", "which", "who", "whom", "whose",
]);

// Từ vựng tiếng Anh phổ biến & chuyên ngành để nhận diện từ chuẩn khi ghép
const COMMON_DICTIONARY_WORDS = new Set<string>([
  "preface", "introduction", "computer", "operating", "system", "systems",
  "architecture", "hardware", "software", "processor", "memory", "storage",
  "programming", "development", "information", "technology", "algorithm",
  "application", "execution", "interface", "management", "network", "database",
  "communication", "computation", "structure", "component", "device",
  "environment", "performance", "scheduling", "distributed", "concurrency",
  "synchronization", "interrupt", "abstraction", "instruction", "virtual",
  "overview", "summary", "chapter", "section", "background", "conclusion",
  "definition", "implementation", "fundamental", "engineering", "machine",
  "language", "compiler", "interpreter", "runtime", "firmware", "pipeline",
  "protocol", "register", "controller", "microcontroller", "analysis",
  "concept", "concepts", "process", "processes", "thread", "threads",
  "resource", "resources", "security", "protection", "mechanism", "mechanisms",
  "service", "services", "function", "functions", "procedure", "module",
  "library", "framework", "platform", "principle", "principles", "technique",
  "techniques", "optimization", "evaluation", "experiment", "method", "methods",
  "strategy", "design", "model", "approach", "pattern", "problem", "problems",
  "solution", "solutions", "challenge", "challenges", "feature", "features",
  "requirement", "requirements", "specification", "organization", "behavior",
  "over", "under", "about", "after", "before", "between", "through", "during",
  "once", "again", "always", "often", "never", "sometimes", "usually", "these",
  "those", "there", "their", "where", "which", "whose", "while", "since",
  "because", "although", "though", "however", "therefore", "furthermore",
]);

/**
 * 1. Khử ngắt chữ do kerning / drop-caps tiêu đề (Kerning / Spaced Letters / Drop-caps repair).
 * Ví dụ:
 * - "pre F a C e" -> "Preface"
 * - "c omputer" -> "computer"
 * - "i ntroduction" -> "introduction"
 * - "O P E R A T I N G" -> "OPERATING"
 * - "A r c h i t e c t u r e" -> "Architecture"
 * Guard: Giữ nguyên "a book", "in the room", "is on", "I am".
 */
export function repairKerningAndDropCaps(text: string): string {
  let result = text;

  // Pattern A: Từ hoặc tiền tố kết hợp chuỗi ký tự đơn rải rác (vd: "pre F a C e", "p r e F a C e")
  result = result.replace(
    /\b([a-zA-Z]{2,})((?:\s+[a-zA-Z])+)\b/g,
    (fullMatch, prefix, spacedLetters) => {
      const letters = spacedLetters.trim().split(/\s+/);
      const combined = (prefix + letters.join("")).toLowerCase();
      if (COMMON_DICTIONARY_WORDS.has(combined) || combined === "preface") {
        const isUpper = prefix === prefix.toUpperCase() && letters.every((l: string) => l === l.toUpperCase());
        if (isUpper) return combined.toUpperCase();
        return combined.charAt(0).toUpperCase() + combined.slice(1);
      }
      return fullMatch;
    }
  );

  // Pattern B: 3 ký tự đơn trở lên đứng liền kề phân cách bởi khoảng trắng (vd: "O P E R A T I N G", "A r c h i t e c t u r e", "p r e f a c e")
  result = result.replace(
    /\b([a-zA-Z](?:\s+[a-zA-Z]){2,})\b/g,
    (fullMatch, matched) => {
      const parts = matched.split(/\s+/);
      if (parts.length < 3) return fullMatch;

      // Guard: Không ghép nếu chứa các từ đơn lẻ hợp lệ tạo thành cụm câu (vd: "I a m" không ghép)
      const combined = parts.join("");
      const lower = combined.toLowerCase();

      // Nếu toàn bộ là chữ in hoa (vd: "O P E R A T I N G" -> "OPERATING", "C H A P T E R" -> "CHAPTER")
      const isAllUpper = parts.every((p: string) => p === p.toUpperCase());
      if (isAllUpper && parts.length >= 3) {
        if (COMMON_DICTIONARY_WORDS.has(lower) || parts.length >= 4) {
          return combined.toUpperCase();
        }
      }

      if (COMMON_DICTIONARY_WORDS.has(lower)) {
        if (parts[0] === parts[0].toUpperCase()) {
          return lower.charAt(0).toUpperCase() + lower.slice(1);
        }
        return lower;
      }

      // Nếu từ ghép dài >= 5 chữ cái và không có từ tiếng Anh hợp lệ nào trong các phần tử rời rạc
      if (parts.length >= 5 && parts.filter((p: string) => STANDALONE_WORDS.has(p.toLowerCase())).length <= 1) {
        return parts[0] === parts[0].toUpperCase()
          ? lower.charAt(0).toUpperCase() + lower.slice(1)
          : lower;
      }

      return fullMatch;
    }
  );

  // Pattern C: Chữ cái đơn đầu từ bị tách do drop-cap hoặc lỗi font kerning
  // (vd: "c omputer", "i ntroduction", "d atabase", "s ystem", "T he", "O nce")
  result = result.replace(
    /\b([a-zA-Z])\s+([a-zA-Z]{2,})\b/g,
    (fullMatch, firstLetter: string, restOfWord: string) => {
      const firstLower = firstLetter.toLowerCase();
      const restLower = restOfWord.toLowerCase();
      const mergedLower = (firstLetter + restOfWord).toLowerCase();

      // Guard 1: "a book", "in the room", "is on", "I am"
      // Nếu chữ cái đầu là 'a' hoặc 'A' và từ đằng sau là một từ tiếng Anh hợp lệ đứng độc lập -> KHÔNG GHÉP
      if (firstLower === "a" && STANDALONE_WORDS.has(restLower)) {
        return fullMatch;
      }

      // Guard 2: 'I' là đại từ đứng độc lập trong tiếng Anh
      if (firstLetter === "I" && STANDALONE_WORDS.has(restLower)) {
        return fullMatch;
      }

      // Trường hợp 'i' thường đứng trước từ không hợp lệ (vd: "i ntroduction") -> GHÉP
      if (firstLower === "i" && !STANDALONE_WORDS.has(restLower)) {
        if (COMMON_DICTIONARY_WORDS.has(mergedLower) || restOfWord.length >= 4) {
          return firstLetter === "I"
            ? mergedLower.charAt(0).toUpperCase() + mergedLower.slice(1)
            : mergedLower;
        }
      }

      // Trường hợp chữ cái phụ âm trong [b-hj-zB-HJ-Z] (không phải từ độc lập trong tiếng Anh)
      const nonStandaloneLetters = /^[b-hj-zB-HJ-Z]$/;
      if (nonStandaloneLetters.test(firstLetter)) {
        // Nếu phần còn lại KHÔNG PHẢI là từ độc lập (vd: "omputer", "rogramming", "atabase")
        if (!STANDALONE_WORDS.has(restLower)) {
          return firstLetter + restOfWord;
        }

        // Nếu phần còn lại là từ độc lập (vd: "T he", "O ver", "O nce") nhưng từ ghép lại là từ chuẩn
        if (COMMON_DICTIONARY_WORDS.has(mergedLower)) {
          return firstLetter === firstLetter.toUpperCase()
            ? mergedLower.charAt(0).toUpperCase() + mergedLower.slice(1)
            : mergedLower;
        }
      }

      return fullMatch;
    }
  );

  return result;
}

/**
 * 2. Chuẩn hóa bullet glyphs hỏng:
 * Chuyển "■ ■", "\u25A0", "\uF0A7", "\uF0B7", font symbol 'r' trước động từ viết hoa thành "\n\n- ".
 */
export function normalizeBrokenBullets(text: string): string {
  let result = text;

  // Chuyển cụm ký tự ■ ■ hoặc ■ đơn lẻ
  result = result.replace(/(?:^|\n)\s*(?:■\s*■|■|\u25A0|\uF0A7|\uF0B7|•|\u2022|\u25CF|\u25CB|\u25AA|\u25E6)\s*/g, "\n\n- ");

  // Font symbol 'r' bị map từ Wingdings/Dingbats trước từ viết hoa ở đầu dòng (vd: "r Provide", "r Manage")
  result = result.replace(/(?:^|\n)\s*r\s+(?=[A-Z][a-z]+)/g, "\n\n- ");

  // Dọn dẹp khoảng trống và dấu gạch đầu dòng dư thừa
  result = result.replace(/\n{3,}- /g, "\n\n- ");
  result = result.replace(/^\n+/, "");

  return result;
}

/**
 * 3. Khử gãy dòng mềm (de-hyphenation) thông minh:
 * Ghép từ bị ngắt dòng ("techno-\nlogy" -> "technology"),
 * đồng thời bảo toàn các từ ghép thực sự ("state-of-the-art", "well-known", "multi-tiered").
 */
export function smartDehyphenate(text: string): string {
  return text.replace(
    /([a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*)-\s*(?:\r?\n|\r)\s*([a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*)/g,
    (fullMatch, part1: string, part2: string) => {
      const lowerPart1 = part1.toLowerCase();
      const lowerPart2 = part2.toLowerCase();
      const hyphenated = `${lowerPart1}-${lowerPart2}`;
      const joined = `${lowerPart1}${lowerPart2}`;

      // 1. Nếu là từ ghép thực sự đã biết trong TRUE_COMPOUND_WORDS -> GIỮ NGUYÊN DẤU GẠCH NỐI
      if (TRUE_COMPOUND_WORDS.has(hyphenated)) {
        return `${part1}-${part2}`;
      }

      // 2. Nếu tiền tố thuộc nhóm COMPOUND_PREFIXES (vd: "multi-", "well-", "state-of-")
      if (COMPOUND_PREFIXES.has(lowerPart1)) {
        return `${part1}-${part2}`;
      }

      // 3. Nếu dạng ghép liền (joined) là từ tiếng Anh chuẩn (vd: "technology", "operating", "computer")
      if (COMMON_DICTIONARY_WORDS.has(joined)) {
        // Bảo toàn cách viết hoa
        if (part1 === part1.toUpperCase() && part2 === part2.toUpperCase()) {
          return joined.toUpperCase();
        }
        if (part1[0] === part1[0].toUpperCase()) {
          return joined.charAt(0).toUpperCase() + joined.slice(1);
        }
        return joined;
      }

      // 4. Nếu part2 là hậu tố phổ biến (-ology, -tion, -ing, -ment, -ity, -able, -ible, -ance, -ence, -ous, -ful, -less, -ness, -ly, -er, -or, -ed, -al, -ic)
      const commonSuffixes = /^(?:ology|tion|sion|ing|ment|ity|able|ible|ance|ence|ous|ful|less|ness|ly|er|or|ed|al|ic|ist|ive|ure|ize|ise|ism)/i;
      if (commonSuffixes.test(part2)) {
        return `${part1}${part2}`;
      }

      // Mặc định cho trường hợp gãy dòng tài liệu: ghép liền từ
      return `${part1}${part2}`;
    }
  );
}

/**
 * 4. Un-flattening đề mục:
 * Tách các section số bị nén trên một dòng (vd: "1.1 Overview 1.2 Architecture")
 * thành "\n\n### 1.1 Overview\n\n### 1.2 Architecture".
 */
export function unflattenHeadings(text: string): string {
  const lines = text.split(/\r?\n/);
  const processedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      processedLines.push("");
      continue;
    }

    // Kiểm tra dòng có chứa ít nhất 2 section số và tiêu đề TitleCase nén lại
    // Pattern: 1.1 Title 1.2 Title hoặc Section 1 Title Section 2 Title
    const multiSectionRegex = /(?:^|\s+)((?:\d+\.){1,3}\d*)\s+([A-Z][a-zA-Z0-9]*(?:\s+[A-Z][a-zA-Z0-9]*)*)/g;
    const matches = Array.from(trimmed.matchAll(multiSectionRegex));

    if (matches.length >= 2) {
      // Dòng này là flattened headers, un-flatten từng header
      const headers = matches.map((m) => {
        const secNum = m[1];
        const secTitle = m[2];
        const level = secNum.includes(".") && secNum.split(".").filter(Boolean).length >= 2 ? "###" : "##";
        return `${level} ${secNum} ${secTitle}`;
      });
      processedLines.push(headers.join("\n\n"));
    } else {
      processedLines.push(line);
    }
  }

  return processedLines.join("\n");
}

/**
 * 5. Dọn dẹp dòng boilerplate lặp lại:
 * Lọc bỏ "This page intentionally left blank", các thông báo số trang rải rác.
 */
export function removeBoilerplate(text: string): string {
  const lines = text.split(/\r?\n/);
  const cleanedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Lọc bỏ "This page intentionally left blank" (bất kể hoa/thường, ngoặc vuông hay dấu gạch)
    if (/^[\[(—-]*(?:this\s+page\s+intentionally\s+left\s+blank)[\])—-]*\.?$/i.test(trimmed)) {
      continue;
    }

    // Lọc thông báo số trang rải rác (vd: "Page 12 of 350", "Trang 12 / 100", "— 12 —", "[Page 5]")
    if (/^(?:\[|\()?page\s+\d+(?:\s*(?:of|\/)\s*\d+)?(?:\]|\))?\.?$/i.test(trimmed)) {
      continue;
    }
    if (/^(?:\[|\()?trang\s+\d+(?:\s*(?:\/|của)\s*\d+)?(?:\]|\))?\.?$/i.test(trimmed)) {
      continue;
    }
    if (/^[-—–]\s*\d+\s*[-—–]$/.test(trimmed)) {
      continue;
    }

    // Lọc dòng chỉ chứa duy nhất một con số trang trần (lone page number)
    if (/^\d{1,4}$/.test(trimmed)) {
      continue;
    }

    cleanedLines.push(line);
  }

  return cleanedLines.join("\n");
}

/**
 * Hàm làm sạch tổng thể toàn bộ tài liệu học thuật / PDF / DOCX
 */
export function cleanTextbookArtifacts(text: string): string {
  if (!text || !text.trim()) return "";

  // BƯỚC 1: Dọn boilerplate & số trang rải rác
  let result = removeBoilerplate(text);

  // BƯỚC 2: Chuẩn hóa bullet glyphs (chạy trước kerning để bảo toàn 'r Verb' thành '- Verb')
  result = normalizeBrokenBullets(result);

  // BƯỚC 3: Khử ngắt chữ do kerning & drop-caps
  result = repairKerningAndDropCaps(result);

  // BƯỚC 4: Khử gãy dòng mềm (smart de-hyphenation)
  result = smartDehyphenate(result);

  // BƯỚC 5: Un-flattening đề mục bị nén trên một dòng
  result = unflattenHeadings(result);

  // BƯỚC 6: Chuẩn hóa khoảng trắng và dòng trống liên tiếp
  result = result.replace(/[ \t]+/g, " ");
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

/**
 * Tính điểm số nhiễu typographic của một chunk văn bản
 * Phục vụ quyết định có cần AI repair ở Pha 2 hay không.
 * @returns score: thang điểm từ 0 đến 100 (càng cao càng nhiễu), reasons: danh sách nguyên nhân
 */
export function calculateChunkNoiseScore(text: string): { score: number; reasons: string[] } {
  if (!text || !text.trim()) {
    return { score: 0, reasons: [] };
  }

  let score = 0;
  const reasons: string[] = [];

  // 1. Gạch nối hở / dangling hyphens ở cuối dòng
  const danglingHyphens = (text.match(/\b[a-zA-Z]{2,}-\s*(?:\r?\n|$)/g) || []).length;
  if (danglingHyphens > 0) {
    const penalty = Math.min(30, danglingHyphens * 6);
    score += penalty;
    reasons.push(`Phát hiện ${danglingHyphens} dấu gạch nối ngắt dòng chưa xử lý (+${penalty}đ)`);
  }

  // 2. Ký tự rác typographic / footnote / wingdings glyphs (‡, †, §, ¶, \uFFFD, \uF0A7...)
  const junkGlyphs = (text.match(/[‡†§¶™©®◊\uFFFD\uF0A7\uF0B7\uF0A8]/g) || []).length;
  if (junkGlyphs > 0) {
    const penalty = Math.min(25, junkGlyphs * 5);
    score += penalty;
    reasons.push(`Phát hiện ${junkGlyphs} ký tự rác typographic/glyph lỗi (+${penalty}đ)`);
  }

  // 3. Kerning / Chữ cái rời rạc bất thường
  const spacedKerning = (text.match(/\b[a-zA-Z](?:\s+[a-zA-Z]){2,}\b/g) || []).length;
  const dropCapsKerning = (text.match(/\b[b-hj-zB-HJ-Z]\s+[a-z]{2,}\b/g) || []).length;
  const totalKerning = spacedKerning + dropCapsKerning;
  if (totalKerning > 0) {
    const penalty = Math.min(30, totalKerning * 8);
    score += penalty;
    reasons.push(`Phát hiện ${totalKerning} lỗi rách chữ do kerning/drop-caps (+${penalty}đ)`);
  }

  // 4. Bullet glyphs hỏng chưa chuẩn hóa (■, \u25A0...)
  const brokenBullets = (text.match(/[■\u25A0\uF0A7]/g) || []).length;
  if (brokenBullets > 0) {
    const penalty = Math.min(20, brokenBullets * 4);
    score += penalty;
    reasons.push(`Phát hiện ${brokenBullets} ký tự bullet hỏng (+${penalty}đ)`);
  }

  // 5. Section headers bị nén trên một dòng
  const flattenedHeaders = (text.match(/(?:^|\s+)(?:\d+\.){1,3}\d*\s+[A-Z][a-zA-Z0-9]*\s+(?:\d+\.){1,3}\d*\s+[A-Z]/g) || []).length;
  if (flattenedHeaders > 0) {
    const penalty = Math.min(20, flattenedHeaders * 10);
    score += penalty;
    reasons.push(`Phát hiện ${flattenedHeaders} dòng đề mục bị nén (+${penalty}đ)`);
  }

  // 6. Tỷ lệ dòng quá ngắn (diagram labels / OCR fragmentation)
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 8) {
    const shortLines = lines.filter((l) => l.length < 15 && !/^#{1,3}\s+/.test(l) && !/^[-*•]\s+/.test(l));
    const shortRatio = shortLines.length / lines.length;
    if (shortRatio > 0.3) {
      const penalty = Math.round(shortRatio * 30);
      score += penalty;
      reasons.push(`Tỷ lệ dòng ngắn/nhãn sơ đồ cao (${Math.round(shortRatio * 100)}%) (+${penalty}đ)`);
    }
  }

  const finalScore = Math.min(100, Math.max(0, Math.round(score)));

  return {
    score: finalScore,
    reasons,
  };
}
