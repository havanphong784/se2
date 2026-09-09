# Technical Specification: Smart Document Reader & AI Breakdown

## 1. Feature Overview
Tài liệu đọc hiểu tiếng Anh thông minh với giao diện chia đôi (Split-View):
- **Cột trái**: Hiển thị nội dung tài liệu gốc từ 3 nguồn: Nhập văn bản (Text), Tải file PDF, hoặc Tải file Ảnh (Client OCR).
  - Tách đoạn và câu trực quan.
  - Highlight màu sắc từ loại cho 100% từ vựng (Danh từ, Động từ, Tính từ, Trạng từ, Đại từ, Giới từ, Liên từ, Mạo từ...).
  - Hover vào từ/cụm từ hiển thị Popover tức thì (Phiên âm IPA, loại từ, nghĩa tiếng Việt, từ đồng nghĩa, nút nghe audio).
  - Click vào câu -> Active trạng thái và kích hoạt phân tích chuyên sâu ở cột phải.
- **Cột phải**: Phân tích câu chuyên sâu bằng Local AI (Ollama/LM Studio kết nối qua Cloudflare Tunnel):
  - Bản dịch ngữ cảnh tiếng Việt.
  - Viết lại câu đơn giản (Simplified English A2/B1).
  - Mổ xẻ cấu trúc ngữ pháp (Grammar pattern, mệnh đề, Subject - Verb - Object).
  - Từ vựng trọng tâm trong ngữ cảnh câu + Nút "+ Lưu vào Deck" (kết nối trực tiếp `/api/words` của Vocabloom).
  - Thành ngữ & Collocation trong câu.
- **Cấu hình AI**:
  - Modal cài đặt endpoint Local AI (Cloudflare Tunnel: `https://xxx.trycloudflare.com/v1`, Model Name: `qwen2.5:7b` / `llama3.1:8b`).
  - Hỗ trợ kiểm tra kết nối (Ping Test `/models`).
  - Caching kết quả phân tích trên Client (IndexedDB / Local Storage) theo hash của câu để phản hồi 0ms khi xem lại.

## 2. Design System Tokens (DESIGN.md)
- Không dùng drop-shadow.
- Nút bấm và card dùng viền nổi 3D: `border-2 border-b-4 rounded-xl`.
- Màu sắc chủ đạo:
  - Primary CTA: Ecto Green (`#58cc02`), hover/border-b: Eel Light (`#d7ffb8`) hoặc darker green.
  - Secondary Action: Macaw Blue (`#1cb0f6`).
  - Outline/Link: Lingot Lime (`#a5ed6e`).
  - Heading & Text chính: Eel Dark Blue (`#042c60`).
  - Subtext: Ash (`#777777`).

## 3. Data Schema & Contracts

### 3.1 Part of Speech (POS) Tagging
- Noun: `#0284c7` (Sky Blue)
- Verb: `#ea580c` (Orange)
- Adjective: `#9333ea` (Purple)
- Adverb: `#d97706` (Amber)
- Pronoun: `#0d9488` (Teal)
- Preposition: `#4b5563` (Slate)
- Conjunction: `#e11d48` (Rose)
- Determiner: `#64748b` (Muted)
- Other: Mặc định

### 3.2 AI Structured Output JSON
```json
{
  "sentence": "string",
  "translationVi": "string",
  "simplifiedEnglish": "string",
  "grammar": {
    "pattern": "string",
    "explanation": "string",
    "clauses": [
      {
        "clauseText": "string",
        "role": "Main Clause" | "Subordinate Clause" | "Relative Clause" | "Adverbial Clause",
        "subject": "string",
        "verb": "string",
        "objectOrComplement": "string"
      }
    ]
  },
  "vocabulary": [
    {
      "term": "string",
      "ipa": "string",
      "partOfSpeech": "string",
      "contextMeaningVi": "string",
      "cefr": "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
    }
  ],
  "idiomsAndPhrases": [
    {
      "phrase": "string",
      "meaningVi": "string"
    }
  ]
}
```

## 4. Acceptance Criteria
1. Chạy `pnpm run typecheck` không có lỗi TypeScript.
2. Chạy `pnpm run lint` không có lỗi ESLint.
3. Chạy `npm test` các bài test hiện có pass 100%.
4. Chạy `npm run build` hoàn tất thành công.
5. Người dùng có thể paste text, tải PDF hoặc ảnh để bóc tách câu, hiển thị màu từ loại, tra hover và phân tích câu qua Local AI.
