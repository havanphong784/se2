# VocaBloom

Ứng dụng học tiếng Anh bằng Next.js, tập trung vào học từ vựng với flashcard, phát âm và lịch ôn ngắt quãng.

## Công nghệ

- Next.js 16 App Router + React 19
- Tailwind CSS v4 + component theo shadcn/ui
- Framer Motion + Recharts
- PostgreSQL/Supabase + Drizzle ORM

## Chạy local với PostgreSQL

```bash
pnpm install
docker compose up -d postgres
cp .env.example .env.local       # Windows PowerShell: Copy-Item .env.example .env.local
pnpm db:migrate
pnpm db:seed
pnpm db:verify
pnpm dev
```

Mở `http://localhost:3000`. `.env.example` trỏ tới PostgreSQL local được khai báo trong `compose.yaml`.

## Chạy với Supabase

Đặt `DATABASE_URL` trong `.env.local` thành direct URL hoặc pooler URL hiện còn hoạt động của project Supabase, sau đó chạy:

```bash
pnpm db:migrate
pnpm db:seed
pnpm db:verify
pnpm dev
```

Kết nối từ xa tự bật SSL. Direct hostname của Supabase có thể không truy cập được trên một số mạng; trong trường hợp đó hãy lấy pooler URL mới nhất từ trang cấu hình project. Không commit `.env.local` hoặc đưa mật khẩu database vào log, ảnh chụp hay tài liệu.

## Chế độ demo và mất kết nối

- Không khai báo `DATABASE_URL`: ứng dụng chạy ở chế độ demo chỉ đọc, hiển thị dữ liệu mẫu và không ghi tiến độ lên máy chủ.
- Có `DATABASE_URL` nhưng database không truy cập được: các trang đọc vẫn hiển thị dữ liệu mẫu kèm cảnh báo; API ghi trả lỗi và không tuyên bố dữ liệu đã được lưu.
- Khi thấy cảnh báo mất kết nối, kiểm tra URL, mạng và chạy `pnpm db:verify`. Một URL Supabase cũ hoặc project đã tạm dừng cần được thay bằng URL hiện tại.

## Import từ vựng

Tại `/vocabulary`, chọn **Nhập từ vựng**. Import yêu cầu database hoạt động và tạo dữ liệu trong bộ cá nhân; bộ hệ thống chỉ đọc. Từ trùng trong cùng bộ được bỏ qua nên tiến độ cũ không bị thay đổi.

CSV cần header `term,translation`; có thể thêm `phonetic,partOfSpeech,exampleSentence,exampleTranslation`:

```csv
term,translation,phonetic,partOfSpeech,exampleSentence,exampleTranslation
hello,xin chào,/həˈləʊ/,thán từ,"Hello, friend.","Xin chào, bạn."
```

JSON là một mảng object với cùng tên trường:

```json
[{ "term": "hello", "translation": "xin chào" }]
```

Giới hạn: 2 MiB và 2.000 dòng mỗi tệp. Chỉ `term` và `translation` bắt buộc.

## Database

Các lệnh database đọc `DATABASE_URL` từ `.env.local`:

```bash
pnpm db:generate       # tạo migration từ schema
pnpm db:migrate        # áp dụng migration
pnpm db:seed           # nạp 4 bộ từ demo
pnpm db:verify         # kiểm tra số bản ghi, RLS và schema Supabase
pnpm db:studio         # mở Drizzle Studio
```

`pnpm db:reset-public` là lệnh phá hủy: xóa toàn bộ schema `public`, nhưng giữ nguyên các schema Supabase được quản lý như `auth`, `storage` và `realtime`.

## Kiểm tra chất lượng

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
