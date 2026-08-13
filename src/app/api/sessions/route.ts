import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { message: "API lưu phiên học cũ đã ngừng hoạt động. Hãy dùng API phiên học mới." },
    { status: 410 },
  );
}
