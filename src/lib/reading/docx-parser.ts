/**
 * Native OpenXML DOCX Parser
 * Bóc tách trực tiếp từ cấu trúc file word/document.xml và word/numbering.xml
 * Chuyển đổi chính xác đề mục (Headings), danh sách (Lists), và bảng (Tables) sang Markdown.
 */

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

interface XmlNode {
  [key: string]: unknown;
  ":@"?: Record<string, string>;
}

interface NodeMeta {
  tag: string;
  children: XmlNode[];
  attrs: Record<string, string>;
}

interface NumberingLevelInfo {
  numFmt: "bullet" | "decimal" | string;
  lvlText?: string;
}

interface NumberingDefinitions {
  // numId -> { [ilvl: number]: NumberingLevelInfo }
  numIdMap: Map<string, Map<number, NumberingLevelInfo>>;
}

/**
 * Trích xuất tên tag, danh sách con và thuộc tính của node XML
 */
function getNodeMeta(node: unknown): NodeMeta | null {
  if (!node || typeof node !== "object" || Array.isArray(node)) return null;
  const obj = node as Record<string, unknown>;
  const rawAttrs = obj[":@"];
  const attrs: Record<string, string> =
    rawAttrs && typeof rawAttrs === "object" ? (rawAttrs as Record<string, string>) : {};

  for (const key of Object.keys(obj)) {
    if (key !== ":@") {
      const val = obj[key];
      return {
        tag: key,
        children: Array.isArray(val) ? (val as XmlNode[]) : [],
        attrs,
      };
    }
  }
  return null;
}

/**
 * Trích xuất toàn bộ text phẳng từ một XML node
 */
function extractTextFromXmlNode(node: unknown): string {
  const meta = getNodeMeta(node);
  if (!meta) return "";

  if (meta.tag === "#text") {
    const obj = node as Record<string, unknown>;
    return String(obj["#text"] || "");
  }

  if (meta.tag === "t") {
    let t = "";
    for (const c of meta.children) {
      if (typeof c === "string") {
        t += c;
      } else if (c && typeof c === "object" && "#text" in c) {
        t += String((c as Record<string, unknown>)["#text"]);
      }
    }
    return t;
  }

  if (meta.tag === "tab") return "\t";
  if (meta.tag === "br" || meta.tag === "cr") return "\n";

  let combined = "";
  for (const child of meta.children) {
    combined += extractTextFromXmlNode(child);
  }
  return combined;
}

/**
 * Bóc tách thông tin style đề mục từ thẻ w:pPr -> w:pStyle
 */
function extractParagraphStyle(pNode: unknown): string | null {
  const meta = getNodeMeta(pNode);
  if (!meta) return null;

  for (const child of meta.children) {
    const childMeta = getNodeMeta(child);
    if (childMeta?.tag === "pPr") {
      for (const pprChild of childMeta.children) {
        const pprMeta = getNodeMeta(pprChild);
        if (pprMeta?.tag === "pStyle") {
          return pprMeta.attrs["@_val"] || pprMeta.attrs["val"] || null;
        }
      }
    }
  }
  return null;
}

/**
 * Bóc tách thông tin danh sách w:numPr (numId, ilvl)
 */
function extractParagraphNumbering(pNode: unknown): { numId: string; ilvl: number } | null {
  const meta = getNodeMeta(pNode);
  if (!meta) return null;

  for (const child of meta.children) {
    const childMeta = getNodeMeta(child);
    if (childMeta?.tag === "pPr") {
      for (const pprChild of childMeta.children) {
        const pprMeta = getNodeMeta(pprChild);
        if (pprMeta?.tag === "numPr") {
          let numId = "1";
          let ilvl = 0;

          for (const numChild of pprMeta.children) {
            const numMeta = getNodeMeta(numChild);
            if (numMeta?.tag === "numId") {
              numId = String(numMeta.attrs["@_val"] ?? numMeta.attrs["val"] ?? "1");
            } else if (numMeta?.tag === "ilvl") {
              ilvl = parseInt(String(numMeta.attrs["@_val"] ?? numMeta.attrs["val"] ?? "0"), 10);
            }
          }

          return { numId, ilvl: isNaN(ilvl) ? 0 : ilvl };
        }
      }
    }
  }
  return null;
}

/**
 * Phân tích word/numbering.xml để lấy định dạng bullet/decimal cho từng danh sách
 */
function parseNumberingDefinitions(numberingXml: string, parser: XMLParser): NumberingDefinitions {
  const numIdMap = new Map<string, Map<number, NumberingLevelInfo>>();
  const abstractNumMap = new Map<string, Map<number, NumberingLevelInfo>>();

  try {
    const parsed: unknown = parser.parse(numberingXml);
    const rootArray = Array.isArray(parsed) ? parsed : [];
    const numberingNode = rootArray.find((n: unknown) => {
      const m = getNodeMeta(n);
      return m?.tag === "numbering";
    });
    const numberingMeta = getNodeMeta(numberingNode);
    if (!numberingMeta) return { numIdMap };

    const children = numberingMeta.children;

    // Bước 1: Quét abstractNum
    for (const child of children) {
      const meta = getNodeMeta(child);
      if (meta?.tag === "abstractNum") {
        const abstractNumId = String(meta.attrs["@_abstractNumId"] ?? meta.attrs["abstractNumId"] ?? "");
        if (!abstractNumId) continue;

        const levelMap = new Map<number, NumberingLevelInfo>();

        for (const lvlChild of meta.children) {
          const lvlMeta = getNodeMeta(lvlChild);
          if (lvlMeta?.tag === "lvl") {
            const ilvl = parseInt(String(lvlMeta.attrs["@_ilvl"] ?? lvlMeta.attrs["ilvl"] ?? "0"), 10);
            let numFmt = "decimal";
            let lvlText: string | undefined;

            for (const prop of lvlMeta.children) {
              const propMeta = getNodeMeta(prop);
              if (propMeta?.tag === "numFmt") {
                numFmt = String(propMeta.attrs["@_val"] ?? propMeta.attrs["val"] ?? "decimal");
              } else if (propMeta?.tag === "lvlText") {
                lvlText = String(propMeta.attrs["@_val"] ?? propMeta.attrs["val"] ?? "");
              }
            }

            levelMap.set(isNaN(ilvl) ? 0 : ilvl, { numFmt, lvlText });
          }
        }

        abstractNumMap.set(abstractNumId, levelMap);
      }
    }

    // Bước 2: Quét num mapping (numId -> abstractNumId)
    for (const child of children) {
      const meta = getNodeMeta(child);
      if (meta?.tag === "num") {
        const numId = String(meta.attrs["@_numId"] ?? meta.attrs["numId"] ?? "");
        if (!numId) continue;

        for (const numChild of meta.children) {
          const numMeta = getNodeMeta(numChild);
          if (numMeta?.tag === "abstractNumId") {
            const abstractNumId = String(numMeta.attrs["@_val"] ?? numMeta.attrs["val"] ?? "");
            const levels = abstractNumMap.get(abstractNumId);
            if (levels) {
              numIdMap.set(numId, levels);
            }
          }
        }
      }
    }
  } catch {
    // Nếu numbering.xml lỗi cấu trúc, fallback rỗng
  }

  return { numIdMap };
}

/**
 * Chuyển đổi bảng <w:tbl> thành Markdown Table hoàn chỉnh
 */
function convertTableToMarkdown(tblNode: unknown): string {
  const meta = getNodeMeta(tblNode);
  if (!meta) return "";

  const rows: string[][] = [];

  for (const trChild of meta.children) {
    const trMeta = getNodeMeta(trChild);
    if (trMeta?.tag === "tr") {
      const row: string[] = [];

      for (const tcChild of trMeta.children) {
        const tcMeta = getNodeMeta(tcChild);
        if (tcMeta?.tag === "tc") {
          // Lấy text của tất cả đoạn văn bên trong ô, thay đổi ngắt dòng thành space và escape pipe |
          const cellRaw = extractTextFromXmlNode(tcChild);
          const cellText = cellRaw
            .replace(/[\r\n]+/g, " ")
            .replace(/\|/g, "\\|")
            .trim();
          row.push(cellText);
        }
      }

      if (row.length > 0) {
        rows.push(row);
      }
    }
  }

  if (rows.length === 0) return "";

  const colCount = Math.max(...rows.map((r) => r.length));
  if (colCount === 0) return "";

  const padRow = (r: string[]): string[] => {
    const padded = [...r];
    while (padded.length < colCount) {
      padded.push("");
    }
    return padded;
  };

  const mdLines: string[] = [];

  // Hàng 0 là tiêu đề bảng (Header)
  const header = padRow(rows[0]);
  mdLines.push(`| ${header.join(" | ")} |`);
  mdLines.push(`| ${header.map(() => "---").join(" | ")} |`);

  // Các hàng dữ liệu tiếp theo
  for (let i = 1; i < rows.length; i++) {
    const row = padRow(rows[i]);
    mdLines.push(`| ${row.join(" | ")} |`);
  }

  return mdLines.join("\n");
}

/**
 * Phân tích trực tiếp binary file DOCX sang chuỗi Markdown chuẩn cấu trúc
 */
export async function parseDocxToMarkdown(
  fileOrBuffer: File | ArrayBuffer | Uint8Array | Buffer
): Promise<string> {
  let buffer: ArrayBuffer;
  if (typeof File !== "undefined" && fileOrBuffer instanceof File) {
    buffer = await fileOrBuffer.arrayBuffer();
  } else if (fileOrBuffer instanceof Uint8Array) {
    buffer = fileOrBuffer.buffer.slice(
      fileOrBuffer.byteOffset,
      fileOrBuffer.byteOffset + fileOrBuffer.byteLength
    ) as ArrayBuffer;
  } else {
    buffer = fileOrBuffer as ArrayBuffer;
  }

  if (buffer.byteLength > 50 * 1024 * 1024) {
    throw new Error("Tệp DOCX vượt quá dung lượng tối đa cho phép (50MB)");
  }

  // 1. Mở file nén DOCX (ZIP archive)
  const zip = await JSZip.loadAsync(buffer);

  // 2. Đọc file word/document.xml bắt buộc
  const documentXmlFile = zip.file("word/document.xml");
  if (!documentXmlFile) {
    throw new Error("Không tìm thấy tệp word/document.xml trong file DOCX.");
  }
  const documentXml = await documentXmlFile.async("string");

  // 3. Đọc file word/numbering.xml (nếu có) để chuẩn hóa danh sách
  const numberingXmlFile = zip.file("word/numbering.xml");
  const numberingXml = numberingXmlFile ? await numberingXmlFile.async("string") : null;

  // 4. Khởi tạo XML parser bảo toàn thứ tự đọc (preserveOrder)
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    preserveOrder: true,
    trimValues: false,
  });

  const numberingDefs = numberingXml
    ? parseNumberingDefinitions(numberingXml, parser)
    : { numIdMap: new Map() };

  const parsedDoc: unknown = parser.parse(documentXml);
  const rootArray = Array.isArray(parsedDoc) ? parsedDoc : [];

  // Tìm node <w:body>
  const docNode = rootArray.find((n: unknown) => {
    const m = getNodeMeta(n);
    return m?.tag === "document";
  });
  const docMeta = getNodeMeta(docNode);
  const bodyNode = docMeta?.children.find((n: unknown) => {
    const m = getNodeMeta(n);
    return m?.tag === "body";
  });
  const bodyMeta = getNodeMeta(bodyNode);
  const bodyElements: XmlNode[] = bodyMeta?.children || [];

  if (bodyElements.length === 0) {
    throw new Error("Tài liệu Word không có phần thân (w:body rỗng).");
  }

  const markdownBlocks: string[] = [];
  const listCounters = new Map<string, number>(); // numId_ilvl -> counter

  for (const element of bodyElements) {
    const meta = getNodeMeta(element);
    if (!meta) continue;

    // A. XỬ LÝ ĐOẠN VĂN <w:p>
    if (meta.tag === "p") {
      const text = extractTextFromXmlNode(element).trim();
      if (!text) continue;

      const pStyle = extractParagraphStyle(element);
      const numPr = extractParagraphNumbering(element);

      // 1. Headings theo style (Heading 1, Title -> #; Heading 2 -> ##; Heading 3 -> ###)
      if (pStyle) {
        const lowerStyle = pStyle.toLowerCase().replace(/[\s_-]/g, "");
        if (lowerStyle === "heading1" || lowerStyle === "title") {
          markdownBlocks.push(`# ${text}`);
          continue;
        }
        if (lowerStyle === "heading2" || lowerStyle === "subtitle") {
          markdownBlocks.push(`## ${text}`);
          continue;
        }
        if (lowerStyle === "heading3") {
          markdownBlocks.push(`### ${text}`);
          continue;
        }
        if (/^heading[4-6]$/.test(lowerStyle)) {
          markdownBlocks.push(`### ${text}`);
          continue;
        }
      }

      // 2. Danh sách có thứ tự hoặc gạch đầu dòng (Lists w:numPr)
      if (numPr) {
        const levelInfo = numberingDefs.numIdMap.get(numPr.numId)?.get(numPr.ilvl);
        const indent = "  ".repeat(Math.max(0, numPr.ilvl));

        if (levelInfo?.numFmt === "bullet") {
          markdownBlocks.push(`${indent}- ${text}`);
        } else {
          // Numbered list
          const counterKey = `${numPr.numId}_${numPr.ilvl}`;
          const currentCount = (listCounters.get(counterKey) || 0) + 1;
          listCounters.set(counterKey, currentCount);
          markdownBlocks.push(`${indent}${currentCount}. ${text}`);
        }
        continue;
      }

      // 3. Đoạn văn thông thường
      markdownBlocks.push(text);
    }

    // B. XỬ LÝ BẢNG BIỂU <w:tbl>
    else if (meta.tag === "tbl") {
      const tableMd = convertTableToMarkdown(element);
      if (tableMd.trim()) {
        markdownBlocks.push(tableMd);
      }
    }
  }

  const finalMarkdown = markdownBlocks.join("\n\n").trim();
  if (!finalMarkdown) {
    throw new Error("Không thể trích xuất nội dung văn bản từ file DOCX.");
  }

  return finalMarkdown;
}
