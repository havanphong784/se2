import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cleanTextbookArtifacts,
  calculateChunkNoiseScore,
  repairKerningAndDropCaps,
  normalizeBrokenBullets,
  smartDehyphenate,
  unflattenHeadings,
  removeBoilerplate,
} from "./textbook-cleaner";

describe("Textbook Cleaner & Artifact Normalization", () => {
  describe("Kerning & Drop-Caps Repair", () => {
    it("khử ngắt chữ tiêu đề do kerning hoặc drop-caps", () => {
      assert.equal(repairKerningAndDropCaps("pre F a C e"), "Preface");
      assert.equal(repairKerningAndDropCaps("c omputer"), "computer");
      assert.equal(repairKerningAndDropCaps("i ntroduction"), "introduction");
      assert.equal(repairKerningAndDropCaps("O P E R A T I N G"), "OPERATING");
      assert.equal(repairKerningAndDropCaps("A r c h i t e c t u r e"), "Architecture");
      assert.equal(repairKerningAndDropCaps("d atabase"), "database");
    });

    it("bảo vệ các từ tiếng Anh hợp lệ đứng độc lập không bị ghép bừa bãi", () => {
      assert.equal(repairKerningAndDropCaps("a book"), "a book");
      assert.equal(repairKerningAndDropCaps("in the room"), "in the room");
      assert.equal(repairKerningAndDropCaps("is on"), "is on");
      assert.equal(repairKerningAndDropCaps("I am a student"), "I am a student");
      assert.equal(repairKerningAndDropCaps("He is in a car"), "He is in a car");
    });
  });

  describe("Broken Bullet Glyphs Normalization", () => {
    it("chuẩn hóa các ký tự bullet vuông, wingdings bị hỏng", () => {
      const input = `■ ■ Overview of the core concepts
■ Memory management
\u25A0 Storage hierarchy
\uF0A7 Process scheduling`;

      const result = normalizeBrokenBullets(input);
      assert.ok(result.includes("- Overview of the core concepts"));
      assert.ok(result.includes("- Memory management"));
      assert.ok(result.includes("- Storage hierarchy"));
      assert.ok(result.includes("- Process scheduling"));
      assert.ok(!result.includes("■"));
      assert.ok(!result.includes("\u25A0"));
      assert.ok(!result.includes("\uF0A7"));
    });

    it("chuyển font symbol 'r' trước động từ viết hoa thành bullet list", () => {
      const input = `Key responsibilities:
r Provide an abstraction for application programs
r Manage hardware resources efficiently
r Implement memory protection mechanisms`;

      const result = normalizeBrokenBullets(input);
      assert.ok(result.includes("- Provide an abstraction for application programs"));
      assert.ok(result.includes("- Manage hardware resources efficiently"));
      assert.ok(result.includes("- Implement memory protection mechanisms"));
      assert.ok(!result.includes("r Provide"));
    });
  });

  describe("Smart De-hyphenation", () => {
    it("ghép liền từ bị ngắt dòng do dàn trang", () => {
      const input = `Modern techno-
logy relies on high-speed comput-
ing and robust archi-
tecture.`;

      const result = smartDehyphenate(input);
      assert.ok(result.includes("technology"), "Phải ghép thành technology");
      assert.ok(result.includes("computing"), "Phải ghép thành computing");
      assert.ok(result.includes("architecture"), "Phải ghép thành architecture");
      assert.ok(!result.includes("techno-"));
    });

    it("bảo toàn các từ ghép thực sự (True Compound Words)", () => {
      const input = `We use state-of-
the-art models and well-
known algorithms on multi-
tiered architectures with real-
time constraints.`;

      const result = smartDehyphenate(input);
      assert.ok(result.includes("state-of-the-art"), "Phải bảo toàn state-of-the-art");
      assert.ok(result.includes("well-known"), "Phải bảo toàn well-known");
      assert.ok(result.includes("multi-tiered"), "Phải bảo toàn multi-tiered");
      assert.ok(result.includes("real-time"), "Phải bảo toàn real-time");
    });
  });

  describe("Un-flattening Headings", () => {
    it("tách các section số bị nén trên một dòng thành các heading markdown riêng biệt", () => {
      const input = "1.1 Overview 1.2 Architecture";
      const result = unflattenHeadings(input);

      assert.equal(result, "### 1.1 Overview\n\n### 1.2 Architecture");
    });

    it("xử lý nhiều section và phân cấp chính xác", () => {
      const input = "2.1 Hardware Components 2.2 Software Stack 2.3 Summary";
      const result = unflattenHeadings(input);

      assert.equal(
        result,
        "### 2.1 Hardware Components\n\n### 2.2 Software Stack\n\n### 2.3 Summary"
      );

      const topLevel = "1. Introduction 2. Background";
      assert.equal(unflattenHeadings(topLevel), "## 1. Introduction\n\n## 2. Background");
    });
  });

  describe("Boilerplate Removal", () => {
    it("lọc bỏ dòng 'This page intentionally left blank' và số trang rải rác", () => {
      const input = `Operating Systems Concepts
This page intentionally left blank
Page 42 of 500
— 42 —
15
Actual content that must be kept.`;

      const result = removeBoilerplate(input);
      assert.ok(!result.includes("This page intentionally left blank"));
      assert.ok(!result.includes("Page 42 of 500"));
      assert.ok(!result.includes("— 42 —"));
      assert.ok(!result.includes("\n15\n"));
      assert.ok(result.includes("Actual content that must be kept."));
    });
  });

  describe("Pipeline cleanTextbookArtifacts Toàn diện", () => {
    it("làm sạch kết hợp toàn bộ các loại lỗi trong một văn bản học thuật", () => {
      const messyAcademicDoc = `pre F a C e

This page intentionally left blank
Page 1 of 200

1.1 Overview 1.2 System Architecture

Modern c omputer systems employ multi-
tiered memory caches.
■ ■ Features:
r Provide abstraction
r Protect memory

The state-of-
the-art techno-
logy is documented in a book.`;

      const cleaned = cleanTextbookArtifacts(messyAcademicDoc);

      // Kerning & drop-caps
      assert.ok(cleaned.includes("Preface"), "pre F a C e -> Preface");
      assert.ok(cleaned.includes("computer"), "c omputer -> computer");
      assert.ok(cleaned.includes("a book"), "Guard a book được giữ nguyên");

      // Dehyphenation
      assert.ok(cleaned.includes("multi-tiered"), "multi-tiered được bảo toàn gạch nối");
      assert.ok(cleaned.includes("state-of-the-art"), "state-of-the-art được bảo toàn");
      assert.ok(cleaned.includes("technology"), "techno-logy ghép thành technology");

      // Headings
      assert.ok(cleaned.includes("### 1.1 Overview"));
      assert.ok(cleaned.includes("### 1.2 System Architecture"));

      // Bullets
      assert.ok(cleaned.includes("- Features:"));
      assert.ok(cleaned.includes("- Provide abstraction"));
      assert.ok(cleaned.includes("- Protect memory"));

      // Boilerplate
      assert.ok(!cleaned.includes("intentionally left blank"));
      assert.ok(!cleaned.includes("Page 1 of 200"));
    });
  });

  describe("Noise Score Calculation", () => {
    it("đoạn văn sạch có điểm nhiễu thấp hoặc bằng 0", () => {
      const cleanText = `This chapter explores modern operating system architecture.
The kernel manages physical memory, scheduling, and device drivers.
Applications interact with the kernel through system calls.`;

      const { score, reasons } = calculateChunkNoiseScore(cleanText);
      assert.equal(score, 0);
      assert.equal(reasons.length, 0);
    });

    it("đoạn văn chứa nhiều artifact có điểm nhiễu cao và liệt kê rõ nguyên nhân", () => {
      const corruptedText = `operat-
ing sys-
tems are com-
plex.
■ ■ Bullet one
‡ Corrupted note
† Footnote reference
c omputer p rogramming
1.1 Intro 1.2 Outro`;

      const { score, reasons } = calculateChunkNoiseScore(corruptedText);
      assert.ok(score >= 30, `Score phải cao (nhận được: ${score})`);
      assert.ok(reasons.length >= 3, "Phải liệt kê ít nhất 3 nguyên nhân");
    });

    it("điểm nhiễu giảm rõ rệt sau khi chạy cleanTextbookArtifacts", () => {
      const noisyText = `pre F a C e
1.1 Overview 1.2 Architecture
Modern techno-
logy uses c omputer memory.
■ ■ First item
r Manage resources
This page intentionally left blank`;

      const before = calculateChunkNoiseScore(noisyText);
      const cleaned = cleanTextbookArtifacts(noisyText);
      const after = calculateChunkNoiseScore(cleaned);

      assert.ok(before.score > 20, "Trước khi làm sạch score phải cao");
      assert.ok(after.score < before.score, "Sau khi làm sạch score phải giảm mạnh");
      assert.equal(after.score, 0, "Sau khi làm sạch toàn diện điểm nhiễu phải về 0");
    });
  });
});
