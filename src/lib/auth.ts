import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { isUuid } from "@/lib/server-data";

export const AUTH_COOKIE_NAME = "vocabloom_session";
export const demoEmail = process.env.DEMO_USER_EMAIL ?? "demo@vocabloom.vn";

export type AuthUser = {
  id: string;
  displayName: string;
  email: string;
  isDemo: boolean;
};

export async function getDemoUser(db: NonNullable<ReturnType<typeof getDb>>) {
  try {
    const [user] = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
      })
      .from(users)
      .where(eq(users.email, demoEmail))
      .limit(1);

    return user ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentAuthUser(
  db: NonNullable<ReturnType<typeof getDb>>,
): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (userId && isUuid(userId)) {
      const [user] = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user) {
        return {
          ...user,
          isDemo: user.email === demoEmail,
        };
      }
    }
  } catch {
    // Fallback when outside request scope
  }

  try {
    const demoUser = await getDemoUser(db);
    if (!demoUser) return null;

    return {
      ...demoUser,
      isDemo: true,
    };
  } catch {
    return null;
  }
}
