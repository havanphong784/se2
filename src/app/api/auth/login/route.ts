import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createRefreshSession } from "@/lib/auth-sessions";
import { hashPassword, needsPasswordRehash, verifyPassword } from "@/lib/auth-crypto";
import { clientIp, isRateLimited } from "@/lib/auth-rate-limit";
import {
  createAccessToken,
  noStoreHeaders,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
} from "@/lib/auth-tokens";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ email và mật khẩu." },
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

    const cleanEmail = email.trim().toLowerCase();
    if (await isRateLimited(db, [
      { scope: "login-ip", key: clientIp(request) ?? cleanEmail, maxAttempts: 20, windowSeconds: 15 * 60 },
      { scope: "login-email", key: cleanEmail, maxAttempts: 10, windowSeconds: 15 * 60 },
    ])) {
      return NextResponse.json(
        { error: "Quá nhiều lần đăng nhập. Vui lòng thử lại sau." },
        { status: 429, headers: noStoreHeaders },
      );
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json(
        { error: "Email hoặc mật khẩu không chính xác." },
        { status: 401, headers: noStoreHeaders },
      );
    }

    if (!user.emailVerifiedAt) {
      return NextResponse.json(
        { error: "Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email.", unverified: true },
        { status: 403, headers: noStoreHeaders },
      );
    }

    if (needsPasswordRehash(user.passwordHash)) {
      await db
        .update(users)
        .set({ passwordHash: await hashPassword(password), updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }

    const session = await createRefreshSession(db, user.id);
    const response = NextResponse.json(
      {
        accessToken: await createAccessToken(user.id, user.authVersion),
        user: { id: user.id, email: user.email, displayName: user.displayName },
      },
      { headers: noStoreHeaders },
    );
    response.cookies.set(REFRESH_COOKIE_NAME, session.token, refreshCookieOptions());
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Đã có lỗi xảy ra khi đăng nhập." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
