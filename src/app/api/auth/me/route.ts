import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { getCurrentAuthUser } from "@/lib/auth";

export async function GET() {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ user: null, source: "demo-unconfigured" });
  }

  const user = await getCurrentAuthUser(db);
  return NextResponse.json({ user });
}
