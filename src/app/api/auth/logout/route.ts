import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { revokeRefreshSession } from "@/lib/auth-sessions";
import {
  noStoreHeaders,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
} from "@/lib/auth-tokens";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(REFRESH_COOKIE_NAME)?.value;
  const db = getDb();
  if (db && token) await revokeRefreshSession(db, token);

  const response = NextResponse.json({ success: true }, { headers: noStoreHeaders });
  response.cookies.set(REFRESH_COOKIE_NAME, "", refreshCookieOptions(0));
  return response;
}
