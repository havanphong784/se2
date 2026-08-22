import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth-crypto";
import { clientIp, isRateLimited } from "@/lib/auth-rate-limit";
import { noStoreHeaders } from "@/lib/auth-tokens";
import { createVerificationToken } from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/mailer";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { displayName, email, password } = body;
    if (!displayName || typeof displayName !== "string" || !email || typeof email !== "string" || !password || typeof password !== "string") {
      return NextResponse.json({ error: "Vui lòng nhập đầy đủ thông tin đăng ký." }, { status: 400, headers: noStoreHeaders });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName.trim();
    if (!cleanName || password.length < 6) {
      return NextResponse.json({ error: cleanName ? "Mật khẩu phải có ít nhất 6 ký tự." : "Vui lòng nhập tên hiển thị." }, { status: 400, headers: noStoreHeaders });
    }

    const db = getDb();
    if (!db) return NextResponse.json({ error: "Cơ sở dữ liệu tạm thời không khả dụng." }, { status: 503, headers: noStoreHeaders });
    if (await isRateLimited(db, [
      { scope: "register-ip", key: clientIp(request) ?? cleanEmail, maxAttempts: 5, windowSeconds: 60 * 60 },
      { scope: "register-email", key: cleanEmail, maxAttempts: 3, windowSeconds: 60 * 60 },
    ])) {
      return NextResponse.json({ error: "Quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau." }, { status: 429, headers: noStoreHeaders });
    }
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (existing) return NextResponse.json({ error: "Email này đã được sử dụng." }, { status: 400, headers: noStoreHeaders });

    const [user] = await db.insert(users).values({
      email: cleanEmail,
      displayName: cleanName,
      passwordHash: await hashPassword(password),
    }).returning({ id: users.id });
    const token = await createVerificationToken(db, user.id);

    try {
      await sendVerificationEmail(cleanEmail, token);
    } catch (error) {
      await db.delete(users).where(eq(users.id, user.id));
      throw error;
    }

    return NextResponse.json({ success: true, message: "Đăng ký thành công. Vui lòng kiểm tra email để kích hoạt tài khoản." }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Không thể gửi email xác thực. Vui lòng thử lại." }, { status: 500, headers: noStoreHeaders });
  }
}
