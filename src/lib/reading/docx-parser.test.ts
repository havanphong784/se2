import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";
import { parseDocxToMarkdown } from "./docx-parser";

describe("Native OpenXML DOCX Parser", () => {
  it("chuyển đổi đúng các cấp độ Heading và Title sang Markdown", async () => {
    const zip = new JSZip();
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Title"/></w:pPr>
      <w:r><w:t>Operating Systems Textbook</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>Chapter 1: Introduction</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>1.1 Core Architecture</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading3"/></w:pPr>
      <w:r><w:t>1.1.1 Kernel Space</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>This is normal body text explaining the kernel.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;

    zip.file("word/document.xml", documentXml);
    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    const md = await parseDocxToMarkdown(buffer);

    assert.ok(md.includes("# Operating Systems Textbook"), "Title phải thành #");
    assert.ok(md.includes("# Chapter 1: Introduction"), "Heading1 phải thành #");
    assert.ok(md.includes("## 1.1 Core Architecture"), "Heading2 phải thành ##");
    assert.ok(md.includes("### 1.1.1 Kernel Space"), "Heading3 phải thành ###");
    assert.ok(md.includes("This is normal body text explaining the kernel."));
  });

  it("chuyển đổi danh sách w:numPr thành bullet list và numbered list", async () => {
    const zip = new JSZip();

    const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
      <w:numFmt w:val="bullet"/>
    </w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0">
      <w:numFmt w:val="decimal"/>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="0"/>
  </w:num>
  <w:num w:numId="2">
    <w:abstractNumId w:val="1"/>
  </w:num>
</w:numbering>`;

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:numPr>
          <w:ilvl w:val="0"/>
          <w:numId w:val="1"/>
        </w:numPr>
      </w:pPr>
      <w:r><w:t>First bullet item</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:numPr>
          <w:ilvl w:val="0"/>
          <w:numId w:val="1"/>
        </w:numPr>
      </w:pPr>
      <w:r><w:t>Second bullet item</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:numPr>
          <w:ilvl w:val="0"/>
          <w:numId w:val="2"/>
        </w:numPr>
      </w:pPr>
      <w:r><w:t>Step one: Fetch instruction</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:numPr>
          <w:ilvl w:val="0"/>
          <w:numId w:val="2"/>
        </w:numPr>
      </w:pPr>
      <w:r><w:t>Step two: Execute instruction</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;

    zip.file("word/numbering.xml", numberingXml);
    zip.file("word/document.xml", documentXml);
    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    const md = await parseDocxToMarkdown(buffer);

    assert.ok(md.includes("- First bullet item"));
    assert.ok(md.includes("- Second bullet item"));
    assert.ok(md.includes("1. Step one: Fetch instruction"));
    assert.ok(md.includes("2. Step two: Execute instruction"));
  });

  it("chuyển đổi bảng w:tbl thành Markdown Table hoàn chỉnh có header và separator", async () => {
    const zip = new JSZip();
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Component</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Role</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Latency</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>L1 Cache</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Fast memory</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>~1 ns</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Main Memory</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>DRAM | Large</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>~100 ns</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`;

    zip.file("word/document.xml", documentXml);
    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    const md = await parseDocxToMarkdown(buffer);

    assert.ok(md.includes("| Component | Role | Latency |"));
    assert.ok(md.includes("| --- | --- | --- |"));
    assert.ok(md.includes("| L1 Cache | Fast memory | ~1 ns |"));
    // Ký tự pipe | trong ô bảng phải được escape thành \|
    assert.ok(md.includes("DRAM \\| Large"));
  });

  it("ném lỗi an toàn khi file không phải là DOCX hợp lệ (thiếu word/document.xml)", async () => {
    const zip = new JSZip();
    zip.file("invalid.txt", "not a docx");
    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    await assert.rejects(
      async () => {
        await parseDocxToMarkdown(buffer);
      },
      {
        message: /word\/document\.xml/,
      }
    );
  });
});
