import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { noStoreHeaders } from "@/lib/auth-tokens";
import { consumeVerificationToken } from "@/lib/email-verification";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  if (!body || typeof body.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token)) {
    return NextResponse.json({ error: "Liên kết xác thực không hợp lệ hoặc đã hết hạn." }, { status: 400, headers: noStoreHeaders });
  }
  const db = getDb();
  if (!db) return NextResponse.json({ error: "Cơ sở dữ liệu tạm thời không khả dụng." }, { status: 503, headers: noStoreHeaders });

  if (!(await consumeVerificationToken(db, body.token))) {
    return NextResponse.json({ error: "Liên kết xác thực không hợp lệ hoặc đã hết hạn." }, { status: 400, headers: noStoreHeaders });
  }
  return NextResponse.json({ success: true, message: "Xác thực email thành công. Bạn có thể đăng nhập ngay." }, { headers: noStoreHeaders });
}
