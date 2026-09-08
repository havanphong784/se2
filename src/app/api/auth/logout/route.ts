import { and, eq, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { refreshTokens, users } from "@/db/schema";
import {
  hashRefreshToken,
  noStoreHeaders,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
} from "@/lib/auth-tokens";
import { isSameOrigin } from "@/lib/auth-origin";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403, headers: noStoreHeaders });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(REFRESH_COOKIE_NAME)?.value;
  const db = getDb();
  if (db && token) {
    const tokenHash = await hashRefreshToken(token);
    await db.transaction(async (tx) => {
      const [session] = await tx
        .select({ userId: refreshTokens.userId })
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1)
        .for("update");
      if (!session) return;

      const now = new Date();
      await tx
        .update(refreshTokens)
        .set({ revokedAt: now })
        .where(and(eq(refreshTokens.userId, session.userId), isNull(refreshTokens.revokedAt)));
      await tx
        .update(users)
        .set({ authVersion: sql`${users.authVersion} + 1`, updatedAt: now })
        .where(eq(users.id, session.userId));
    });
  }

  const response = NextResponse.json({ success: true }, { headers: noStoreHeaders });
  response.cookies.set(REFRESH_COOKIE_NAME, "", refreshCookieOptions(0));
  return response;
}
