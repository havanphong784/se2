# VocaBloom

Ứng dụng học tiếng Anh bằng Next.js, tập trung vào học từ vựng với flashcard, phát âm và lịch ôn ngắt quãng.

## Công nghệ

- Next.js 16 App Router + React 19
- Tailwind CSS v4 + component theo shadcn/ui
- Framer Motion + Recharts
- PostgreSQL/Supabase + Drizzle ORM

## Chạy local

```bash
pnpm install
Copy-Item .env.example .env.local
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Mở `http://localhost:3000`.

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
