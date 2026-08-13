import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { message: "API đánh giá flashcard cũ đã ngừng hoạt động. Hãy dùng API phiên học." },
    { status: 410 },
  );
}
