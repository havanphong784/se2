import { eq } from "drizzle-orm";

import type { getDb } from "@/db";
import { users } from "@/db/schema";
import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { cookies } from "next/headers";

export const demoEmail = process.env.DEMO_USER_EMAIL ?? "demo@vocabloom.vn";

export async function getDemoUser(db: NonNullable<ReturnType<typeof getDb>>) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (userId && isUuid(userId)) {
      const [user] = await db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user) return user;
    }
  } catch {
    // Fallback when outside request scope
  }

  try {
    const [user] = await db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(eq(users.email, demoEmail))
      .limit(1);

    return user ?? null;
  } catch {
    return null;
  }
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
