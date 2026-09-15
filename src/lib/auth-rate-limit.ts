import { createHash } from "node:crypto";
import { eq, lt, sql } from "drizzle-orm";

import type { getDb } from "@/db";
import { authRateLimits } from "@/db/schema";

type Db = NonNullable<ReturnType<typeof getDb>>;

export type Limit = {
  scope: string;
  key: string;
  maxAttempts: number;
  windowSeconds: number;
};

export function keyHash(scope: string, key: string) {
  return createHash("sha256").update(`${scope}:${key}`).digest("hex");
}

export function windowStart(now: Date, windowSeconds: number) {
  const windowMs = windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || null;
}

export async function isRateLimited(db: Db, limits: Limit[], now = new Date()) {
  return db.transaction(async (tx) => {
    for (const limit of limits) {
      const [bucket] = await tx
        .insert(authRateLimits)
        .values({ keyHash: keyHash(limit.scope, limit.key), windowStartedAt: windowStart(now, limit.windowSeconds) })
        .onConflictDoUpdate({
          target: [authRateLimits.keyHash, authRateLimits.windowStartedAt],
          set: { attempts: sql`${authRateLimits.attempts} + 1` },
        })
        .returning({ attempts: authRateLimits.attempts });
      if (bucket.attempts > limit.maxAttempts) return true;
    }

    // ponytail: opportunistic cleanup; add a scheduled DB job only if table growth becomes measurable.
    if (Math.random() < 0.01) {
      await tx
        .delete(authRateLimits)
        .where(lt(authRateLimits.windowStartedAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)));
    }
    return false;
  });
}

export async function resetRateLimit(db: Db, limits: Limit[]) {
  if (limits.length === 0) return;
  return db.transaction(async (tx) => {
    for (const limit of limits) {
      await tx
        .delete(authRateLimits)
        .where(eq(authRateLimits.keyHash, keyHash(limit.scope, limit.key)));
    }
  });
}
