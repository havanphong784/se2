import { eq } from "drizzle-orm";

import type { getDb } from "@/db";
import { users } from "@/db/schema";

export const demoEmail = process.env.DEMO_USER_EMAIL ?? "demo@vocabloom.vn";

export async function getDemoUser(db: NonNullable<ReturnType<typeof getDb>>) {
  const [user] = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(eq(users.email, demoEmail))
    .limit(1);

  return user ?? null;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
