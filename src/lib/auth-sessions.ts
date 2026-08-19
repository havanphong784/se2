import { and, eq, gt, isNull } from "drizzle-orm";

import type { getDb } from "@/db";
import { refreshTokens } from "@/db/schema";
import {
  createRefreshToken,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_SECONDS,
} from "@/lib/auth-tokens";

type Db = NonNullable<ReturnType<typeof getDb>>;

export type RefreshSession = {
  token: string;
  expiresAt: Date;
};

export async function createRefreshSession(db: Db, userId: string): Promise<RefreshSession> {
  const token = createRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
  await db.insert(refreshTokens).values({
    userId,
    tokenHash: await hashRefreshToken(token),
    expiresAt,
  });
  return { token, expiresAt };
}

export async function rotateRefreshSession(db: Db, token: string) {
  const tokenHash = await hashRefreshToken(token);
  const now = new Date();

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    if (!current || current.expiresAt <= now) return null;

    if (current.revokedAt) {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: now })
        .where(and(eq(refreshTokens.userId, current.userId), isNull(refreshTokens.revokedAt)));
      return null;
    }

    const nextToken = createRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
    const [next] = await tx
      .insert(refreshTokens)
      .values({
        userId: current.userId,
        tokenHash: await hashRefreshToken(nextToken),
        expiresAt,
      })
      .returning({ id: refreshTokens.id });

    const [revoked] = await tx
      .update(refreshTokens)
      .set({ revokedAt: now, lastUsedAt: now, replacedById: next.id })
      .where(
        and(
          eq(refreshTokens.id, current.id),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, now),
        ),
      )
      .returning({ id: refreshTokens.id });

    if (!revoked) {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: now })
        .where(and(eq(refreshTokens.userId, current.userId), isNull(refreshTokens.revokedAt)));
      return null;
    }

    return { userId: current.userId, token: nextToken, expiresAt };
  });
}

export async function revokeRefreshSession(db: Db, token: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, await hashRefreshToken(token)), isNull(refreshTokens.revokedAt)));
}
