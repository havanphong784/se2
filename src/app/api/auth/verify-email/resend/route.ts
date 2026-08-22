import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { noStoreHeaders } from "@/lib/auth-tokens";
import { clientIp, isRateLimited } from "@/lib/auth-rate-limit";
import { createVerificationToken } from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/mailer";

const response = () => NextResponse.json(
  { success: true, message: "Nếu email tồn tại và chưa được kích hoạt, liên kết xác thực mới đã được gửi." },
  { headers: noStoreHeaders },
);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return response();
  const db = getDb();
  if (!db) return response();
  if (await isRateLimited(db, [
    { scope: "resend-ip", key: clientIp(request) ?? email, maxAttempts: 10, windowSeconds: 60 * 60 },
    { scope: "resend-email", key: email, maxAttempts: 1, windowSeconds: 60 },
  ])) return response();

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.emailVerifiedAt)))
    .limit(1);
  if (!user) return response();

  try {
    await sendVerificationEmail(user.email, await createVerificationToken(db, user.id));
  } catch (error) {
    console.error("Verification resend error:", error);
  }
  return response();
}
