import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { rotateRefreshSession } from "@/lib/auth-sessions";
import {
  createAccessToken,
  noStoreHeaders,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
} from "@/lib/auth-tokens";
import { getAuthUser } from "@/lib/auth";
import { isSameOrigin } from "@/lib/auth-origin";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403, headers: noStoreHeaders });
  }

  const db = getDb();
  const token = (await cookies()).get(REFRESH_COOKIE_NAME)?.value;

  if (!db || !token) {
    return NextResponse.json({ error: "Phiên đăng nhập đã hết hạn." }, { status: 401, headers: noStoreHeaders });
  }

  const session = await rotateRefreshSession(db, token);
  if (!session) {
    const response = NextResponse.json(
      { error: "Phiên đăng nhập đã hết hạn." },
      { status: 401, headers: noStoreHeaders },
    );
    response.cookies.set(REFRESH_COOKIE_NAME, "", refreshCookieOptions(0));
    return response;
  }
  if (session.status === "conflict") {
    return NextResponse.json(
      { error: "Phiên đăng nhập vừa được làm mới." },
      { status: 409, headers: noStoreHeaders },
    );
  }

  const user = await getAuthUser(db, session.userId);
  if (!user) {
    const response = NextResponse.json({ error: "Phiên đăng nhập đã hết hạn." }, { status: 401, headers: noStoreHeaders });
    response.cookies.set(REFRESH_COOKIE_NAME, "", refreshCookieOptions(0));
    return response;
  }

  const response = NextResponse.json(
    { accessToken: await createAccessToken(user.id, user.authVersion), user },
    { headers: noStoreHeaders },
  );
  response.cookies.set(REFRESH_COOKIE_NAME, session.token, refreshCookieOptions());
  return response;
}
