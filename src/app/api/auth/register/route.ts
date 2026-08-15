import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { hashPassword } from "@/lib/auth-crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { displayName, email, password } = body;

    if (
      !displayName ||
      typeof displayName !== "string" ||
      !email ||
      typeof email !== "string" ||
      !password ||
      typeof password !== "string"
    ) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ thông tin đăng ký." },
        { status: 400 },
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName.trim();

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Mật khẩu phải có ít nhất 6 ký tự." },
        { status: 400 },
      );
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json(
        { error: "Cơ sở dữ liệu tạm thời không khả dụng." },
        { status: 503 },
      );
    }

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "Email này đã được sử dụng." },
        { status: 400 },
      );
    }

    const passwordHash = hashPassword(password);
    const [newUser] = await db
      .insert(users)
      .values({
        email: cleanEmail,
        displayName: cleanName,
        passwordHash,
      })
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
      });

    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, newUser.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return NextResponse.json({
      success: true,
      user: newUser,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Đã có lỗi xảy ra khi đăng ký." },
      { status: 500 },
    );
  }
}
