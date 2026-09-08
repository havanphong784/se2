import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { requireAuth } from "@/lib/auth";
import { noStoreHeaders } from "@/lib/auth-tokens";

export async function GET(request: Request) {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ user: null }, { status: 503, headers: noStoreHeaders });
  }

  const user = await requireAuth(request, db);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401, headers: noStoreHeaders });
  }

  return NextResponse.json({ user }, { headers: noStoreHeaders });
}
