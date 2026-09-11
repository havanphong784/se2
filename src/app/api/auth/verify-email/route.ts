import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { noStoreHeaders } from "@/lib/auth-tokens";
import { consumeVerificationToken } from "@/lib/email-verification";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    token?: unknown;
    email?: unknown;
    code?: unknown;
  } | null;

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Dữ liệu yêu cầu không hợp lệ." },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const token = typeof body.token === "string" ? body.token.trim() : undefined;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
  const code = typeof body.code === "string" ? body.code.trim() : undefined;

  const isTokenMode = Boolean(token && /^[a-f0-9]{64}$/.test(token));
  const isOtpMode = Boolean(email && email.includes("@") && code && /^\d{6}$/.test(code));

  if (!isTokenMode && !isOtpMode) {
    return NextResponse.json(
      { error: "Thông tin xác thực không hợp lệ. Vui lòng kiểm tra mã OTP 6 số hoặc liên kết xác thực." },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { error: "Cơ sở dữ liệu tạm thời không khả dụng." },
      { status: 503, headers: noStoreHeaders },
    );
  }

  const payload = isTokenMode ? { token } : { email, code };
  const verified = await consumeVerificationToken(db, payload);

  if (!verified) {
    return NextResponse.json(
      {
        error: isOtpMode
          ? "Mã xác thực không đúng, đã hết hạn hoặc đã được sử dụng."
          : "Liên kết xác thực không hợp lệ hoặc đã hết hạn.",
      },
      { status: 400, headers: noStoreHeaders },
    );
  }

  return NextResponse.json(
    { success: true, message: "Xác thực email thành công. Bạn có thể đăng nhập ngay." },
    { headers: noStoreHeaders },
  );
}
